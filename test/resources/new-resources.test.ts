import { describe, expect, it } from "vitest";
import { Corvo } from "../../src/client";
import { VERSION, isSchedule } from "../../src/index";
import { API_KEY, BASE_URL, jsonResponse } from "../helpers";

interface Call {
	url: URL;
	method: string;
	headers: Record<string, string>;
	body: unknown;
	rawBody: unknown;
}

function setup(respond: (call: Call) => Response): { corvo: Corvo; calls: Call[] } {
	const calls: Call[] = [];
	const corvo = new Corvo({
		apiKey: API_KEY,
		baseUrl: BASE_URL,
		fetch: async (url, init) => {
			const raw = init?.body;
			const call: Call = {
				url: new URL(url),
				method: String(init?.method),
				headers: (init?.headers ?? {}) as Record<string, string>,
				body: typeof raw === "string" ? JSON.parse(raw) : undefined,
				rawBody: raw,
			};
			calls.push(call);
			return respond(call);
		},
	});
	return { corvo, calls };
}

const page = { limit: 2, hasMore: true, nextCursor: "c2" };
const lastPage = { limit: 2, hasMore: false, nextCursor: null };

describe("headers", () => {
	it("sends x-api-key and a User-Agent with the SDK version", async () => {
		const { corvo, calls } = setup(() => jsonResponse({ status: "ok" }));
		await corvo.health.live();
		expect(calls[0].headers["X-API-Key"]).toBe(API_KEY);
		expect(calls[0].headers["User-Agent"]).toBe(`corvo-nfse-node/${VERSION}`);
		expect(VERSION).toBe("0.3.0");
	});
});

describe("invoices.create: immediate, schedule and recurring", () => {
	const base = { amount: 100, competenceDate: "2026-12-01", service: { code: "100901" } };

	it("returns the Invoice for an immediate emission and sends Idempotency-Key", async () => {
		const { corvo, calls } = setup(() =>
			jsonResponse(
				{ data: { id: "inv_1", status: "queued", documentsStatus: "pending" } },
				{ status: 202 },
			),
		);
		const res = await corvo.invoices.create(base, { idempotencyKey: "k1" });
		expect(res.data?.status).toBe("queued");
		expect(isSchedule(res.data)).toBe(false);
		expect(calls[0].method).toBe("POST");
		expect(calls[0].headers["Idempotency-Key"]).toBe("k1");
	});

	it("returns the Schedule (snake_case) for SCHEDULE and RECURRING", async () => {
		const schedule = {
			id: "sch_1",
			kind: "recurring",
			status: "active",
			anchor_on: "2026-12-01",
			company_id: "c1",
			frequency: "MONTHLY",
			next_run_on: "2026-12-01",
			ends_on: null,
			invoice: {},
		};
		const { corvo, calls } = setup(() => jsonResponse({ data: schedule }, { status: 202 }));
		const res = await corvo.invoices.create({
			...base,
			options: { type: "RECURRING", recurrence: { frequency: "MONTHLY", endsOn: "2027-12-01" } },
		});
		expect(res.data?.next_run_on).toBe("2026-12-01");
		expect(isSchedule(res.data)).toBe(true);
		expect(calls[0].body).toMatchObject({
			options: { type: "RECURRING", recurrence: { frequency: "MONTHLY", endsOn: "2027-12-01" } },
		});
	});

	it("sends a foreign customer, purchaseOrder and notes untouched", async () => {
		const { corvo, calls } = setup(() => jsonResponse({ data: { id: "inv_1" } }, { status: 202 }));
		await corvo.invoices.create({
			...base,
			purchaseOrder: "PO-1",
			notes: "obs",
			customer: {
				name: "ACME",
				foreign: {
					taxId: "X1",
					country: "US",
					postalCode: "10001",
					city: "NY",
					region: "NY",
					street: "5th",
					number: "1",
					district: "Midtown",
				},
			},
		});
		expect(calls[0].body).toMatchObject({ purchaseOrder: "PO-1", notes: "obs" });
		expect(calls[0].body).toMatchObject({ customer: { foreign: { country: "US" } } });
	});
});

describe("invoices: new operations", () => {
	it("sendEmail sends the optional destination and Idempotency-Key", async () => {
		const { corvo, calls } = setup(() =>
			jsonResponse({ data: { emailId: "e1", status: "queued" } }, { status: 202 }),
		);
		const res = await corvo.invoices.sendEmail("inv_1", { email: "x@y.com", idempotencyKey: "m1" });
		expect(res.data?.emailId).toBe("e1");
		expect(calls[0].url.pathname).toBe("/v1/invoices/inv_1/email");
		expect(calls[0].body).toEqual({ email: "x@y.com" });
		expect(calls[0].headers["Idempotency-Key"]).toBe("m1");
	});

	it("sendEmail without a destination sends no body", async () => {
		const { corvo, calls } = setup(() =>
			jsonResponse({ data: { emailId: "e1", status: "queued" } }),
		);
		await corvo.invoices.sendEmail("inv_1");
		expect(calls[0].body).toBeUndefined();
	});

	it("substitute POSTs the changes with Idempotency-Key", async () => {
		const { corvo, calls } = setup(() =>
			jsonResponse({ data: { id: "inv_2", substitutesInvoiceId: "inv_1" } }, { status: 202 }),
		);
		const res = await corvo.invoices.substitute(
			"inv_1",
			{ description: "Descricao incorreta", service: { description: "Novo" }, notes: "n" },
			{ idempotencyKey: "s1" },
		);
		expect(res.data?.substitutesInvoiceId).toBe("inv_1");
		expect(calls[0].method).toBe("POST");
		expect(calls[0].url.pathname).toBe("/v1/invoices/inv_1/substitute");
		expect(calls[0].headers["Idempotency-Key"]).toBe("s1");
		expect(calls[0].body).toEqual({
			description: "Descricao incorreta",
			service: { description: "Novo" },
			notes: "n",
		});
	});

	it("substitute surfaces ERROR_INVOICE_NOT_SUBSTITUTABLE", async () => {
		const { corvo } = setup(() =>
			jsonResponse(
				{ statusCode: 409, code: "ERROR_INVOICE_NOT_SUBSTITUTABLE", message: "x" },
				{ status: 409 },
			),
		);
		const res = await corvo.invoices.substitute("inv_1", { description: "Descricao incorreta" });
		expect(res.error?.code).toBe("ERROR_INVOICE_NOT_SUBSTITUTABLE");
	});

	it("list filters by customerTaxId", async () => {
		const { corvo, calls } = setup(() => jsonResponse({ data: [], pagination: lastPage }));
		await corvo.invoices.list({ customerTaxId: "12345678909", status: "authorized", limit: 5 });
		expect(calls[0].url.searchParams.get("customerTaxId")).toBe("12345678909");
		expect(calls[0].url.searchParams.get("status")).toBe("authorized");
		expect(calls[0].url.searchParams.get("limit")).toBe("5");
	});

	it("overview sends the period; review sends action and ids", async () => {
		const { corvo, calls } = setup((call) =>
			call.url.pathname.endsWith("review")
				? jsonResponse(
						{
							data: {
								results: [
									{ id: "a", outcome: "accepted" },
									{ id: "b", outcome: "skipped", reason: "changed" },
								],
							},
						},
						{ status: 202 },
					)
				: jsonResponse({
						data: { counts: { authorized: 1, processing: 0, rejected: 0 }, dailyActivity: [] },
					}),
		);
		const overview = await corvo.invoices.overview({ period: "30d" });
		expect(overview.data?.counts.authorized).toBe(1);
		expect(calls[0].url.searchParams.get("period")).toBe("30d");
		const review = await corvo.invoices.review({ action: "discard", invoiceIds: ["a", "b"] });
		expect(review.data?.results[1]).toEqual({ id: "b", outcome: "skipped", reason: "changed" });
		expect(calls[1].body).toEqual({ action: "discard", invoiceIds: ["a", "b"] });
	});

	it("an invoice keeps the corrected fields", async () => {
		const { corvo } = setup(() =>
			jsonResponse({
				data: {
					id: "inv_1",
					documentsReadyAt: "2026-11-01T10:00:00.000Z",
					documentsStatus: "ready",
					emailStatus: "sent",
					lastEmailStatus: "sent",
					stage: "completed",
					portalFlag: "taker_rejected",
				},
			}),
		);
		const res = await corvo.invoices.get("inv_1");
		expect(res.data?.documentsStatus).toBe("ready");
		expect(res.data?.portalFlag).toBe("taker_rejected");
	});
});

describe("credits and billing", () => {
	it("previewPurchase is a GET with units (not the old POST)", async () => {
		const { corvo, calls } = setup(() =>
			jsonResponse({ data: { units: 10, unitPriceCents: 99, totalCents: 990 } }),
		);
		const res = await corvo.credits.previewPurchase(10);
		expect(res.data).toEqual({ units: 10, unitPriceCents: 99, totalCents: 990 });
		expect(calls[0].method).toBe("GET");
		expect(calls[0].url.pathname).toBe("/v1/credits/purchase/preview");
		expect(calls[0].url.searchParams.get("units")).toBe("10");
	});

	it("billing.plan exposes the new fields; 404 NO_PLAN_ASSIGNED is an error", async () => {
		const ok = setup(() =>
			jsonResponse({
				data: {
					plan: { slug: "equipe" },
					subscription: {
						stripe_portal_available: true,
						stripe_subscription: true,
						pix_subscription: null,
					},
					usage: { avulso_balance: 7 },
				},
			}),
		);
		const res = await ok.corvo.billing.plan();
		expect(res.data?.usage.avulso_balance).toBe(7);
		expect(res.data?.subscription.pix_subscription).toBeNull();

		const missing = setup(() =>
			jsonResponse(
				{ statusCode: 404, code: "NO_PLAN_ASSIGNED", message: "No plan", requestId: "r1" },
				{ status: 404 },
			),
		);
		const err = await missing.corvo.billing.plan();
		expect(err.error?.code).toBe("NO_PLAN_ASSIGNED");
		expect(err.error?.requestId).toBe("r1");
	});
});

describe("customers and cnpj", () => {
	it("search paginates with the opaque cursor", async () => {
		const { corvo, calls } = setup((call) =>
			jsonResponse(
				call.url.searchParams.get("cursor") === "c2"
					? { data: [{ taxId: "2", name: "B" }], pagination: lastPage }
					: { data: [{ taxId: "1", name: "A" }], pagination: page },
			),
		);
		const names: string[] = [];
		for await (const c of corvo.customers.iterate({ search: "a", limit: 1 })) names.push(c.name);
		expect(names).toEqual(["A", "B"]);
		expect(calls[0].url.searchParams.get("search")).toBe("a");
		expect(calls[1].url.searchParams.get("cursor")).toBe("c2");
	});

	it("get, update (PATCH) and remove hit /customers/{taxId}", async () => {
		const { corvo, calls } = setup((call) =>
			call.method === "DELETE"
				? jsonResponse({ data: null })
				: jsonResponse({ data: { taxId: "12345678909", name: "Ana", email: null } }),
		);
		await corvo.customers.get("12345678909");
		const upd = await corvo.customers.update("12345678909", { name: "Ana", email: null });
		expect(upd.data?.name).toBe("Ana");
		await corvo.customers.remove("12345678909");
		expect(calls.map((c) => c.method)).toEqual(["GET", "PATCH", "DELETE"]);
		expect(calls[1].body).toEqual({ name: "Ana", email: null });
		for (const c of calls) expect(c.url.pathname).toBe("/v1/customers/12345678909");
	});

	it("cnpj.lookup returns the profile and surfaces CNPJ_INVALID", async () => {
		const ok = setup(() =>
			jsonResponse({ data: { legalName: "ACME", active: true, mei: false, simples: true } }),
		);
		const res = await ok.corvo.cnpj.lookup("11222333000181");
		expect(res.data?.legalName).toBe("ACME");
		expect(ok.calls[0].url.pathname).toBe("/v1/cnpj/11222333000181");

		const bad = setup(() =>
			jsonResponse({ statusCode: 400, code: "CNPJ_INVALID", message: "bad" }, { status: 400 }),
		);
		expect((await bad.corvo.cnpj.lookup("1")).error?.code).toBe("CNPJ_INVALID");
	});
});

describe("company sub-resources", () => {
	it("serviceFavorites create/list/remove", async () => {
		const { corvo, calls } = setup((call) =>
			call.method === "DELETE"
				? jsonResponse({ data: { deleted: true } })
				: call.method === "POST"
					? jsonResponse({ data: { id: "f1", label: "L" } }, { status: 201 })
					: jsonResponse({ data: [{ id: "f1", label: "L" }] }),
		);
		const created = await corvo.companies.serviceFavorites.create("c1", {
			label: "L",
			serviceCode: "100901",
			description: "D",
			amountCents: 5000,
		});
		expect(created.data?.id).toBe("f1");
		expect(calls[0].body).toEqual({
			label: "L",
			serviceCode: "100901",
			description: "D",
			amountCents: 5000,
		});
		expect((await corvo.companies.serviceFavorites.list("c1")).data).toHaveLength(1);
		expect((await corvo.companies.serviceFavorites.remove("c1", "f1")).data).toEqual({
			deleted: true,
		});
		expect(calls[2].url.pathname).toBe("/v1/companies/c1/service-favorites/f1");
	});

	it("accountantPackage get/update/send/listSends", async () => {
		const { corvo, calls } = setup((call) => {
			if (call.url.pathname.endsWith("/sends"))
				return jsonResponse({ data: [{ id: "s1", status: "sent" }] });
			if (call.url.pathname.endsWith("/send")) return jsonResponse({ data: { status: "sent" } });
			if (call.method === "PUT")
				return jsonResponse({
					data: { email: "c@x.com", lastSentMonth: null, testEmailSent: true },
				});
			return jsonResponse({ data: { email: "c@x.com", lastSentMonth: "2026-10" } });
		});
		expect((await corvo.companies.accountantPackage.get("c1")).data?.lastSentMonth).toBe("2026-10");
		const upd = await corvo.companies.accountantPackage.update("c1", {
			accountantEmail: "c@x.com",
		});
		expect(upd.data?.testEmailSent).toBe(true);
		expect(calls[1].method).toBe("PUT");
		expect(calls[1].body).toEqual({ accountantEmail: "c@x.com" });
		const sent = await corvo.companies.accountantPackage.send("c1", { month: "2026-10" });
		expect(sent.data?.status).toBe("sent");
		expect(calls[2].body).toEqual({ month: "2026-10" });
		expect((await corvo.companies.accountantPackage.listSends("c1")).data?.[0].id).toBe("s1");
	});

	it("invoicePackage.summary and download (ZIP bytes, include list)", async () => {
		const { corvo, calls } = setup((call) =>
			call.url.pathname.endsWith("/summary")
				? jsonResponse({ data: { count: 3, total: 300, limit: 500, month: "2026-10" } })
				: new Response(Buffer.from([0x50, 0x4b, 3, 4]), {
						status: 200,
						headers: {
							"content-type": "application/zip",
							"content-disposition": 'attachment; filename="pacote-2026-10.zip"',
						},
					}),
		);
		expect((await corvo.companies.invoicePackage.summary("c1", "2026-10")).data?.count).toBe(3);
		expect(calls[0].url.searchParams.get("month")).toBe("2026-10");
		const zip = await corvo.companies.invoicePackage.download("c1", {
			month: "2026-10",
			include: ["xml", "pdf"],
		});
		expect(zip.data?.buffer[0]).toBe(0x50);
		expect(zip.data?.fileName).toBe("pacote-2026-10.zip");
		expect(zip.data?.mimeType).toBe("application/zip");
		expect(calls[1].url.searchParams.get("include")).toBe("xml,pdf");
	});

	it("invoicePackage.download surfaces PACKAGE_TOO_LARGE", async () => {
		const { corvo } = setup(() =>
			jsonResponse({ statusCode: 422, code: "PACKAGE_TOO_LARGE", message: "x" }, { status: 422 }),
		);
		const res = await corvo.companies.invoicePackage.download("c1", { month: "2026-10" });
		expect(res.error?.code).toBe("PACKAGE_TOO_LARGE");
		expect(res.error?.status).toBe(422);
	});

	it("dpsSequence get/set and DPS_NUMBER_BELOW_CURRENT", async () => {
		const ok = setup(() => jsonResponse({ data: { series: "1", lastNumber: 50 } }));
		await ok.corvo.companies.dpsSequence.get("c1");
		const set = await ok.corvo.companies.dpsSequence.set("c1", { lastNumber: 50 });
		expect(set.data?.lastNumber).toBe(50);
		expect(ok.calls[1].method).toBe("PUT");
		expect(ok.calls[1].body).toEqual({ lastNumber: 50 });

		const bad = setup(() =>
			jsonResponse(
				{ statusCode: 422, code: "DPS_NUMBER_BELOW_CURRENT", message: "x" },
				{ status: 422 },
			),
		);
		expect((await bad.corvo.companies.dpsSequence.set("c1", { lastNumber: 1 })).error?.code).toBe(
			"DPS_NUMBER_BELOW_CURRENT",
		);
	});

	it("fiscalProfiles and serviceTaxProfiles use the right verbs and bodies", async () => {
		const { corvo, calls } = setup(() => jsonResponse({ data: { id: "x" } }));
		await corvo.companies.fiscalProfiles.upsert("c1", {
			taxRegime: "SIMPLES_NACIONAL",
			confirm: true,
		});
		await corvo.companies.fiscalProfiles.approve("c1", "p1");
		await corvo.companies.serviceTaxProfiles.list("c1", { date: "2026-10-01" });
		await corvo.companies.serviceTaxProfiles.update("c1", "s1", { issRate: "2.00" });
		await corvo.companies.serviceTaxProfiles.remove("c1", "s1");
		expect(calls.map((c) => `${c.method} ${c.url.pathname}`)).toEqual([
			"PUT /v1/companies/c1/fiscal-profile",
			"POST /v1/companies/c1/fiscal-profile/p1/approve",
			"GET /v1/companies/c1/service-tax-profiles",
			"PATCH /v1/companies/c1/service-tax-profiles/s1",
			"DELETE /v1/companies/c1/service-tax-profiles/s1",
		]);
		expect(calls[0].body).toEqual({ taxRegime: "SIMPLES_NACIONAL", confirm: true });
		expect(calls[2].url.searchParams.get("date")).toBe("2026-10-01");
	});
});

describe("schedules", () => {
	it("list filters; lifecycle actions are POSTs", async () => {
		const { corvo, calls } = setup((call) =>
			call.url.pathname === "/v1/schedules"
				? jsonResponse({ data: [{ id: "s1", status: "active" }], pagination: lastPage })
				: jsonResponse({ data: { id: "s1", status: "paused" } }),
		);
		const list = await corvo.schedules.list({ status: "active", companyId: "c1", limit: 10 });
		expect(list.data?.data[0].id).toBe("s1");
		expect(calls[0].url.searchParams.get("status")).toBe("active");
		expect(calls[0].url.searchParams.get("companyId")).toBe("c1");
		expect((await corvo.schedules.pause("s1")).data?.status).toBe("paused");
		await corvo.schedules.resume("s1");
		await corvo.schedules.cancel("s1");
		expect(calls.slice(1).map((c) => `${c.method} ${c.url.pathname}`)).toEqual([
			"POST /v1/schedules/s1/pause",
			"POST /v1/schedules/s1/resume",
			"POST /v1/schedules/s1/cancel",
		]);
	});

	it("update PATCHes camelCase fields; listRuns paginates", async () => {
		const { corvo, calls } = setup((call) =>
			call.url.pathname.endsWith("/runs")
				? jsonResponse({ data: [{ id: "r1", outcome: "issued" }], pagination: lastPage })
				: jsonResponse({ data: { id: "s1" } }),
		);
		await corvo.schedules.update("s1", { anchorOn: "2026-12-10", endsOn: null });
		expect(calls[0].method).toBe("PATCH");
		expect(calls[0].body).toEqual({ anchorOn: "2026-12-10", endsOn: null });
		const runs: string[] = [];
		for await (const r of corvo.schedules.iterateRuns("s1")) runs.push(r.outcome);
		expect(runs).toEqual(["issued"]);
	});

	it("surfaces ERROR_SCHEDULE_STATE", async () => {
		const { corvo } = setup(() =>
			jsonResponse(
				{ statusCode: 409, code: "ERROR_SCHEDULE_STATE", message: "x" },
				{ status: 409 },
			),
		);
		expect((await corvo.schedules.pause("s1")).error?.code).toBe("ERROR_SCHEDULE_STATE");
	});
});

describe("imports", () => {
	it("start sends multipart with file and companyId", async () => {
		const { corvo, calls } = setup(() =>
			jsonResponse(
				{ data: { id: "i1", status: "processing", duplicate_of: null } },
				{ status: 202 },
			),
		);
		const res = await corvo.imports.start({
			file: Buffer.from("cnpj,valor\n1,2\n"),
			fileName: "notas.csv",
			companyId: "c1",
		});
		expect(res.data?.id).toBe("i1");
		const form = calls[0].rawBody as FormData;
		expect(form).toBeInstanceOf(FormData);
		expect((form.get("file") as File).name).toBe("notas.csv");
		expect(form.get("companyId")).toBe("c1");
		expect(calls[0].headers["Content-Type"]).toBeUndefined();
	});

	it("get/list/emit/updateRow/discard", async () => {
		const { corvo, calls } = setup((call) =>
			call.method === "DELETE"
				? new Response(null, { status: 204 })
				: jsonResponse({
						data: call.url.pathname === "/v1/imports" ? [{ id: "i1" }] : { id: "i1" },
					}),
		);
		expect((await corvo.imports.list({ limit: 5 })).data).toHaveLength(1);
		expect(calls[0].url.searchParams.get("limit")).toBe("5");
		await corvo.imports.emit("i1", { sendEmail: true });
		expect(calls[1].body).toEqual({ sendEmail: true });
		await corvo.imports.updateRow("i1", 4, { item: { amount: 10 } });
		expect(calls[2].url.pathname).toBe("/v1/imports/i1/rows/4");
		expect(calls[2].method).toBe("PATCH");
		expect((await corvo.imports.discard("i1")).data).toBeNull();
	});

	it("listRows filters by status and paginates", async () => {
		const { corvo, calls } = setup((call) =>
			jsonResponse(
				call.url.searchParams.get("cursor") === "50"
					? { data: [{ line: 2 }], pagination: lastPage }
					: { data: [{ line: 1 }], pagination: { limit: 1, hasMore: true, nextCursor: "50" } },
			),
		);
		const lines: number[] = [];
		for await (const row of corvo.imports.iterateRows("i1", { status: "invalid", limit: 1 }))
			lines.push(row.line);
		expect(lines).toEqual([1, 2]);
		expect(calls[0].url.searchParams.get("status")).toBe("invalid");
	});

	it("downloadTemplate and downloadErrors return the CSV bytes", async () => {
		const { corvo, calls } = setup(
			() =>
				new Response("cnpj,valor\n", {
					status: 200,
					headers: {
						"content-type": "text/csv",
						"content-disposition": 'attachment; filename="modelo.csv"',
					},
				}),
		);
		const tpl = await corvo.imports.downloadTemplate();
		expect(tpl.data?.buffer.toString("utf8")).toBe("cnpj,valor\n");
		expect(tpl.data?.fileName).toBe("modelo.csv");
		await corvo.imports.downloadErrors("i1");
		expect(calls[1].url.pathname).toBe("/v1/imports/i1/errors.csv");
	});

	it("surfaces ERROR_IMPORT_* codes", async () => {
		const { corvo } = setup(() =>
			jsonResponse(
				{ statusCode: 422, code: "ERROR_IMPORT_TOO_MANY_ROWS", message: "x" },
				{ status: 422 },
			),
		);
		const res = await corvo.imports.start({ file: Buffer.from("x") });
		expect(res.error?.code).toBe("ERROR_IMPORT_TOO_MANY_ROWS");
	});
});

describe("integrations", () => {
	it("connections lifecycle uses the right verbs and bodies", async () => {
		const { corvo, calls } = setup(() => jsonResponse({ data: { id: "k1", state: "active" } }));
		await corvo.integrations.connections.create({
			companyId: "c1",
			provider: "stripe",
			credentials: { apiKey: "sk" },
			environment: "test",
		});
		await corvo.integrations.connections.updateCredentials("k1", { apiKey: "sk2" });
		await corvo.integrations.connections.replaceRules("k1", [
			{ sendEmail: true, service: { code: "100901" } },
		]);
		await corvo.integrations.connections.listEvents("k1", { limit: 5 });
		await corvo.integrations.operations.completeCustomer("o1", {
			taxId: "12345678909",
			name: "Ana",
		});
		await corvo.integrations.operations.retry("o1");
		expect(calls.map((c) => `${c.method} ${c.url.pathname}`)).toEqual([
			"POST /v1/integrations/connections",
			"PUT /v1/integrations/connections/k1/credentials",
			"PUT /v1/integrations/connections/k1/rules",
			"GET /v1/integrations/connections/k1/events",
			"PATCH /v1/integrations/operations/o1/customer",
			"POST /v1/integrations/operations/o1/retry",
		]);
		expect(calls[1].body).toEqual({ credentials: { apiKey: "sk2" } });
		expect(calls[2].body).toEqual({ rules: [{ sendEmail: true, service: { code: "100901" } }] });
		expect(calls[3].url.searchParams.get("limit")).toBe("5");
	});
});

describe("fiscal portal, health and webhooks", () => {
	it("fiscalPortal.status", async () => {
		const { corvo } = setup(() =>
			jsonResponse({ data: { available: false, environment: "test", retryAt: null, since: "x" } }),
		);
		expect((await corvo.fiscalPortal.status()).data?.available).toBe(false);
	});

	it("health.live needs no envelope", async () => {
		const { corvo } = setup(() => jsonResponse({ status: "ok", timestamp: "t", uptime: 1 }));
		expect((await corvo.health.live()).data?.status).toBe("ok");
	});

	it("webhooks.test can report a failed delivery; deliveries filter by environment", async () => {
		const { corvo, calls } = setup((call) =>
			call.url.pathname.endsWith("/test")
				? jsonResponse({ data: { sent: false, error: "timeout", statusCode: null } })
				: jsonResponse({ data: [], pagination: lastPage }),
		);
		const res = await corvo.webhooks.test("w1");
		expect(res.data?.sent).toBe(false);
		await corvo.webhooks.deliveries.list({ environment: "live", hours: 2 });
		expect(calls[1].url.searchParams.get("environment")).toBe("live");
	});
});

describe("errors and rate limits", () => {
	it("keeps code, requestId and Retry-After on a 429", async () => {
		const { corvo } = setup(() =>
			jsonResponse(
				{ statusCode: 429, code: "ERROR_RATE_LIMITED", message: "slow", requestId: "rq1" },
				{ status: 429, headers: { "Retry-After": "7", "X-RateLimit-Remaining": "0" } },
			),
		);
		const res = await corvo.customers.get("1");
		expect(res.error?.status).toBe(429);
		expect(res.error?.retryAfter).toBe(7);
		expect(res.error?.requestId).toBe("rq1");
	});
});

describe("invoices.calculate envelope", () => {
	it("unwraps { data } (the controller wraps it, although the contract shows it bare)", async () => {
		const { corvo } = setup(() => jsonResponse({ data: { preEmission: true, status: "ready" } }));
		const res = await corvo.invoices.calculate({
			amount: 1,
			competenceDate: "2026-10-01",
			service: { code: "100901" },
		});
		expect(res.data?.status).toBe("ready");
	});
});
