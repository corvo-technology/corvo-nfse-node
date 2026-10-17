import { describe, expect, it, vi } from "vitest";
import { Corvo } from "../../src/client";
import { API_KEY, BASE_URL, jsonResponse } from "../helpers";

const invoice = {
	id: "f0add80b-5026-4a11-8f00-5fa03be98b5b",
	companyId: "09947127-2702-4f6d-9da8-cb463608d812",
	tenantId: "6247dfd9-0adc-4bf6-aac9-ee9dc1e7ca8b",
	environment: "test",
	documentKeyVersion: 2,
	emailSnapshot: { send: false },
	externalId: "order-42",
	idempotencyKey: null,
	status: "authorized",
	customerSnapshot: {
		name: "Cliente Fictício de Testes",
		email: "cliente@example.com",
		taxId: "52998224725",
		address: { city: "Uberlândia", state: "MG" },
	},
	serviceSnapshot: {
		code: "010101",
		description: "Software development",
		municipalityCode: "3170206",
	},
	taxSnapshot: {},
	amount: 150.5,
	currency: "BRL",
	competenceDate: "2026-10-12T00:00:00.000Z",
	dpsId: "DPS317020624183468700014800001000000000000001",
	dpsSeries: "1",
	dpsNumber: 1,
	accessKey: "02910000000000000001",
	nfseNumber: 1001,
	fiscalProvider: "provider",
	fiscalSchemaVersion: "v2_02",
	issuedAt: "2026-10-12T13:04:40.000Z",
	authorizedAt: "2026-10-12T13:04:41.000Z",
	lastErrorCode: null,
	lastErrorMessage: null,
	lastErrorProvider: null,
	documentsReadyAt: "2026-10-12T13:04:42.000Z",
	lastEmailStatus: null,
	lastEmailSentAt: null,
	createdAt: "2026-10-12T13:04:38.985Z",
	updatedAt: "2026-10-12T13:04:42.000Z",
	documentsStatus: "ready",
	emailStatus: null,
	stage: "documents_ready",
};

function client(fetch: (url: string, init?: RequestInit) => Promise<Response>): Corvo {
	return new Corvo({ apiKey: API_KEY, baseUrl: BASE_URL, fetch });
}

describe("invoices", () => {
	it("create POSTs with Idempotency-Key and returns the invoice", async () => {
		const calls: Array<{ url: string; init: RequestInit }> = [];
		const corvo = client(async (url, init) => {
			calls.push({ url, init: init ?? {} });
			return jsonResponse({ data: invoice }, { status: 202 });
		});
		const res = await corvo.invoices.create(
			{
				companyId: invoice.companyId,
				externalId: "order-42",
				customer: { name: "Cliente", taxId: "52998224725", email: "cliente@example.com" },
				service: {
					code: "010101",
					municipalityCode: "3170206",
					description: "Software development",
				},
				amount: 150.5,
				competenceDate: "2026-10-12",
				options: { email: { send: true } },
			},
			{ idempotencyKey: "order-42" },
		);
		expect(res.error).toBeUndefined();
		expect(res.data?.id).toBe(invoice.id);
		expect(res.data?.status).toBe("authorized");
		expect(calls[0].url).toBe("http://localhost:4000/v1/invoices");
		const headers = calls[0].init.headers as Record<string, string>;
		expect(headers["Idempotency-Key"]).toBe("order-42");
		const body = JSON.parse(String(calls[0].init.body));
		expect(body.options.email.send).toBe(true);
	});

	it("create propagates REST validation errors", async () => {
		const corvo = client(async () =>
			jsonResponse(
				{
					statusCode: 400,
					code: "ERROR_VALIDATION",
					message: "Request validation failed",
					details: [
						{
							field: "service.code",
							code: "ERROR_INVALID_SERVICE_CODE",
							message: "must be 6 digits",
						},
					],
					requestId: "req-77",
				},
				{ status: 400 },
			),
		);
		const res = await corvo.invoices.create({
			companyId: invoice.companyId,
			customer: { name: "x", taxId: "y" },
			service: { code: "1" },
			amount: 1,
			competenceDate: "2026-10-12",
		});
		expect(res.data).toBeUndefined();
		expect(res.error?.code).toBe("ERROR_VALIDATION");
		expect(res.error?.details?.[0].field).toBe("service.code");
		expect(res.error?.requestId).toBe("req-77");
	});

	it("list returns items and keeps the cursor pagination", async () => {
		const corvo = client(async () =>
			jsonResponse({
				data: [invoice],
				pagination: { limit: 50, hasMore: true, nextCursor: "eyJ2IjoxfQ" },
			}),
		);
		const res = await corvo.invoices.list({ companyId: invoice.companyId, status: "authorized" });
		expect(res.error).toBeUndefined();
		expect(res.data?.data[0].nfseNumber).toBe(1001);
		expect(res.data?.pagination).toEqual({ limit: 50, hasMore: true, nextCursor: "eyJ2IjoxfQ" });
	});

	it("get returns the invoice from the data envelope", async () => {
		const seen: string[] = [];
		const corvo = client(async (url) => {
			seen.push(url);
			return jsonResponse({ data: invoice });
		});
		const res = await corvo.invoices.get(invoice.id);
		expect(res.data?.id).toBe(invoice.id);
		expect(seen[0]).toBe(`http://localhost:4000/v1/invoices/${invoice.id}`);
	});

	it("events returns a cursor-paginated list", async () => {
		const corvo = client(async () =>
			jsonResponse({
				data: [
					{
						id: "ev_1",
						invoiceId: invoice.id,
						fromStatus: null,
						toStatus: "queued",
						reason: null,
						createdAt: "2026-10-12T16:06:18.910Z",
					},
					{
						id: "ev_2",
						invoiceId: invoice.id,
						fromStatus: "queued",
						toStatus: "processing",
						reason: "Starting fiscal emission",
						createdAt: "2026-10-12T16:06:18.910Z",
					},
				],
				pagination: { limit: 2, hasMore: true, nextCursor: "ev-cursor" },
			}),
		);
		const res = await corvo.invoices.events(invoice.id, { limit: 2 });
		expect(res.error).toBeUndefined();
		expect(res.data?.data).toHaveLength(2);
		expect(res.data?.data[1].toStatus).toBe("processing");
		expect(res.data?.pagination.nextCursor).toBe("ev-cursor");
	});

	it("iterate preserves filters while walking cursors", async () => {
		const urls: string[] = [];
		const pages = [
			jsonResponse({
				data: [invoice],
				pagination: { limit: 1, hasMore: true, nextCursor: "c1" },
			}),
			jsonResponse({
				data: [{ ...invoice, id: "inv_2" }],
				pagination: { limit: 1, hasMore: false, nextCursor: null },
			}),
		];
		let i = 0;
		const corvo = client(async (url) => {
			urls.push(url);
			return pages[Math.min(i++, pages.length - 1)];
		});
		const ids: string[] = [];
		for await (const item of corvo.invoices.iterate({ companyId: invoice.companyId, limit: 1 })) {
			ids.push(item.id);
		}
		expect(ids).toEqual([invoice.id, "inv_2"]);
		expect(urls[0]).toContain("companyId=");
		expect(urls[0]).not.toContain("cursor=");
		expect(urls[1]).toContain("cursor=c1");
		expect(urls[1]).toContain("companyId=");
	});
});
