import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Corvo } from "../../src/client";
import { WEBHOOK_EVENTS } from "../../src/types/webhook";
import { API_KEY, BASE_URL } from "../helpers";

interface Operation {
	parameters?: Array<{ $ref?: string; name?: string; in?: string; required?: boolean }>;
	operationId: string;
	responses: Record<string, unknown>;
}

interface Spec {
	info: { version: string };
	paths: Record<string, Record<string, Operation>>;
	components: {
		parameters: Record<string, { name: string; in: string; required?: boolean }>;
		schemas: Record<string, { enum?: string[] }>;
	};
}

const spec = JSON.parse(
	readFileSync(new URL("../../spec/openapi.json", import.meta.url), "utf8"),
) as Spec;

interface SpecOperation {
	id: string;
	method: string;
	path: string;
	status: number;
	requiredQuery: string[];
}

const operations: SpecOperation[] = [];
for (const [path, item] of Object.entries(spec.paths)) {
	for (const [method, op] of Object.entries(item)) {
		if (!op.operationId) continue;
		const params = (op.parameters ?? []).map((p) =>
			p.$ref ? spec.components.parameters[p.$ref.split("/").pop() as string] : p,
		);
		const ok = Object.keys(op.responses)
			.filter((code) => code.startsWith("2"))
			.sort()[0];
		operations.push({
			id: op.operationId,
			method: method.toUpperCase(),
			path,
			status: Number(ok),
			requiredQuery: params
				.filter((p) => p?.in === "query" && p.required)
				.map((p) => p?.name ?? ""),
		});
	}
}

const P = "00000000-0000-4000-8000-000000000001";
const file = Buffer.from("a,b\n1,2\n");

type Call = (c: Corvo) => unknown;

/**
 * operationId -> the SDK method that implements it. Every operation of the contract must be here:
 * when the API gains one, `spec/openapi.json` is refreshed and this test fails until it is mapped.
 */
const IMPLEMENTATIONS: Record<string, { call: Call; params?: Record<string, string> }> = {
	accountantPackage_get: {
		call: (c) => c.companies.accountantPackage.get(P),
		params: { companyId: P },
	},
	accountantPackage_listSends: {
		call: (c) => c.companies.accountantPackage.listSends(P),
		params: { companyId: P },
	},
	accountantPackage_send: {
		call: (c) => c.companies.accountantPackage.send(P, { month: "2026-10" }),
		params: { companyId: P },
	},
	accountantPackage_update: {
		call: (c) => c.companies.accountantPackage.update(P, { accountantEmail: "a@b.com" }),
		params: { companyId: P },
	},
	billing_getPlan: { call: (c) => c.billing.plan() },
	billing_getUsage: { call: (c) => c.billing.usage() },
	certificates_list: { call: (c) => c.certificates.list(P), params: { companyId: P } },
	certificates_revoke: {
		call: (c) => c.certificates.remove(P, "cert-1"),
		params: { companyId: P, certId: "cert-1" },
	},
	certificates_upload: {
		call: (c) => c.certificates.upload(P, { file, password: "x" }),
		params: { companyId: P },
	},
	cnpj_lookup: { call: (c) => c.cnpj.lookup("12345678000199"), params: { cnpj: "12345678000199" } },
	companies_create: {
		call: (c) =>
			c.companies.create({
				legalName: "A",
				taxId: "1",
				taxRegime: "MEI",
				municipalityCode: "3550308",
			}),
	},
	companies_delete: { call: (c) => c.companies.remove(P), params: { id: P } },
	companies_get: { call: (c) => c.companies.get(P), params: { id: P } },
	companies_list: { call: (c) => c.companies.list() },
	companies_update: { call: (c) => c.companies.update(P, { tradeName: "B" }), params: { id: P } },
	credits_getBalance: { call: (c) => c.credits.balance() },
	credits_listHistory: { call: (c) => c.credits.history() },
	credits_listPlans: { call: (c) => c.credits.plans() },
	credits_previewPurchase: { call: (c) => c.credits.previewPurchase(10) },
	customers_delete: {
		call: (c) => c.customers.remove("12345678909"),
		params: { taxId: "12345678909" },
	},
	customers_get: { call: (c) => c.customers.get("12345678909"), params: { taxId: "12345678909" } },
	customers_search: { call: (c) => c.customers.search({ search: "ana" }) },
	customers_update: {
		call: (c) => c.customers.update("12345678909", { name: "Ana" }),
		params: { taxId: "12345678909" },
	},
	dpsSequence_get: { call: (c) => c.companies.dpsSequence.get(P), params: { id: P } },
	dpsSequence_set: {
		call: (c) => c.companies.dpsSequence.set(P, { lastNumber: 10 }),
		params: { id: P },
	},
	fiscalPortal_status: { call: (c) => c.fiscalPortal.status() },
	fiscalProfiles_approve: {
		call: (c) => c.companies.fiscalProfiles.approve(P, "prof-1"),
		params: { id: P, profileId: "prof-1" },
	},
	fiscalProfiles_list: { call: (c) => c.companies.fiscalProfiles.list(P), params: { id: P } },
	fiscalProfiles_upsert: {
		call: (c) => c.companies.fiscalProfiles.upsert(P, { taxRegime: "MEI" }),
		params: { id: P },
	},
	health_live: { call: (c) => c.health.live() },
	imports_discard: { call: (c) => c.imports.discard(P), params: { id: P } },
	imports_downloadErrors: { call: (c) => c.imports.downloadErrors(P), params: { id: P } },
	imports_downloadTemplate: { call: (c) => c.imports.downloadTemplate() },
	imports_emit: { call: (c) => c.imports.emit(P, { sendEmail: true }), params: { id: P } },
	imports_get: { call: (c) => c.imports.get(P), params: { id: P } },
	imports_list: { call: (c) => c.imports.list() },
	imports_listRows: { call: (c) => c.imports.listRows(P), params: { id: P } },
	imports_start: { call: (c) => c.imports.start({ file, fileName: "x.csv" }) },
	imports_updateRow: {
		call: (c) => c.imports.updateRow(P, 3, { item: { amount: 1 } }),
		params: { id: P, line: "3" },
	},
	integrationConnections_activate: {
		call: (c) => c.integrations.connections.activate(P),
		params: { id: P },
	},
	integrationConnections_create: {
		call: (c) =>
			c.integrations.connections.create({
				companyId: P,
				provider: "stripe",
				credentials: { k: "v" },
			}),
	},
	integrationConnections_disconnect: {
		call: (c) => c.integrations.connections.disconnect(P),
		params: { id: P },
	},
	integrationConnections_get: { call: (c) => c.integrations.connections.get(P), params: { id: P } },
	integrationConnections_list: { call: (c) => c.integrations.connections.list() },
	integrationConnections_listEvents: {
		call: (c) => c.integrations.connections.listEvents(P),
		params: { id: P },
	},
	integrationConnections_listOperations: {
		call: (c) => c.integrations.connections.listOperations(P),
		params: { id: P },
	},
	integrationConnections_listRules: {
		call: (c) => c.integrations.connections.listRules(P),
		params: { id: P },
	},
	integrationConnections_pause: {
		call: (c) => c.integrations.connections.pause(P),
		params: { id: P },
	},
	integrationConnections_replaceRules: {
		call: (c) => c.integrations.connections.replaceRules(P, []),
		params: { id: P },
	},
	integrationConnections_updateCredentials: {
		call: (c) => c.integrations.connections.updateCredentials(P, { k: "v" }),
		params: { id: P },
	},
	integrationConnections_validate: {
		call: (c) => c.integrations.connections.validate(P),
		params: { id: P },
	},
	integrationOperations_completeCustomer: {
		call: (c) => c.integrations.operations.completeCustomer(P, { taxId: "12345678909" }),
		params: { id: P },
	},
	integrationOperations_retry: {
		call: (c) => c.integrations.operations.retry(P),
		params: { id: P },
	},
	integrations_listProviders: { call: (c) => c.integrations.listProviders() },
	invoicePackage_download: {
		call: (c) => c.companies.invoicePackage.download(P, { month: "2026-10" }),
		params: { companyId: P },
	},
	invoicePackage_summary: {
		call: (c) => c.companies.invoicePackage.summary(P, "2026-10"),
		params: { companyId: P },
	},
	invoices_calculate: {
		call: (c) =>
			c.invoices.calculate({
				amount: 1,
				competenceDate: "2026-10-01",
				service: { code: "100901" },
			}),
	},
	invoices_cancel: {
		call: (c) => c.invoices.cancel(P, { reason: "other" }),
		params: { id: P },
	},
	invoices_create: {
		call: (c) =>
			c.invoices.create({ amount: 1, competenceDate: "2026-10-01", service: { code: "100901" } }),
	},
	invoices_createBatch: { call: (c) => c.invoices.createBatch([]) },
	invoices_createDownloadUrl: {
		call: (c) => c.invoices.downloadUrl(P, "pdf"),
		params: { id: P },
	},
	invoices_downloadPdf: { call: (c) => c.invoices.pdf(P), params: { id: P } },
	invoices_downloadXml: { call: (c) => c.invoices.xml(P), params: { id: P } },
	invoices_get: { call: (c) => c.invoices.get(P), params: { id: P } },
	invoices_list: { call: (c) => c.invoices.list({ customerTaxId: "12345678909" }) },
	invoices_listEvents: { call: (c) => c.invoices.events(P), params: { id: P } },
	invoices_overview: { call: (c) => c.invoices.overview({ period: "30d" }) },
	invoices_review: { call: (c) => c.invoices.review({ action: "retry", invoiceIds: [P] }) },
	invoices_sendEmail: {
		call: (c) => c.invoices.sendEmail(P, { email: "x@y.com" }),
		params: { id: P },
	},
	invoices_substitute: {
		call: (c) => c.invoices.substitute(P, { description: "corrigir descricao do servico" }),
		params: { id: P },
	},
	schedules_cancel: { call: (c) => c.schedules.cancel(P), params: { id: P } },
	schedules_get: { call: (c) => c.schedules.get(P), params: { id: P } },
	schedules_list: { call: (c) => c.schedules.list() },
	schedules_listRuns: { call: (c) => c.schedules.listRuns(P), params: { id: P } },
	schedules_pause: { call: (c) => c.schedules.pause(P), params: { id: P } },
	schedules_resume: { call: (c) => c.schedules.resume(P), params: { id: P } },
	schedules_update: {
		call: (c) => c.schedules.update(P, { anchorOn: "2026-12-01" }),
		params: { id: P },
	},
	serviceFavorites_create: {
		call: (c) =>
			c.companies.serviceFavorites.create(P, {
				label: "L",
				serviceCode: "100901",
				description: "D",
			}),
		params: { companyId: P },
	},
	serviceFavorites_delete: {
		call: (c) => c.companies.serviceFavorites.remove(P, "fav-1"),
		params: { companyId: P, favoriteId: "fav-1" },
	},
	serviceFavorites_list: {
		call: (c) => c.companies.serviceFavorites.list(P),
		params: { companyId: P },
	},
	serviceTaxProfiles_approve: {
		call: (c) => c.companies.serviceTaxProfiles.approve(P, "svc-1"),
		params: { id: P, serviceId: "svc-1" },
	},
	serviceTaxProfiles_create: {
		call: (c) =>
			c.companies.serviceTaxProfiles.create(P, {
				name: "N",
				serviceCode: "100901",
				effectiveFrom: "2026-01-01",
			}),
		params: { id: P },
	},
	serviceTaxProfiles_delete: {
		call: (c) => c.companies.serviceTaxProfiles.remove(P, "svc-1"),
		params: { id: P, serviceId: "svc-1" },
	},
	plans_get: { call: (c) => c.plans.get("solo"), params: { slug: "solo" } },
	plans_list: { call: (c) => c.plans.list() },
	serviceTaxProfiles_list: {
		call: (c) => c.companies.serviceTaxProfiles.list(P, { date: "2026-10-01" }),
		params: { id: P },
	},
	serviceTaxProfiles_update: {
		call: (c) => c.companies.serviceTaxProfiles.update(P, "svc-1", { name: "N2" }),
		params: { id: P, serviceId: "svc-1" },
	},
	webhookDeliveries_list: { call: (c) => c.webhooks.deliveries.list() },
	webhookDeliveries_retry: { call: (c) => c.webhooks.deliveries.retry(P), params: { id: P } },
	webhookDeliveries_stats: { call: (c) => c.webhooks.deliveries.stats() },
	webhooks_create: {
		call: (c) => c.webhooks.create({ url: "https://x.com/h", events: ["nfse.invoice.authorized"] }),
	},
	webhooks_delete: { call: (c) => c.webhooks.remove(P), params: { id: P } },
	webhooks_list: { call: (c) => c.webhooks.list() },
	webhooks_test: { call: (c) => c.webhooks.test(P), params: { id: P } },
};

describe("contract coverage", () => {
	it("targets the contract 0.3.0 with 94 operations", () => {
		expect(spec.info.version).toBe("0.3.0");
		expect(operations).toHaveLength(94);
	});

	it("maps every operationId of the contract, and nothing else", () => {
		const ids = operations.map((o) => o.id).sort();
		expect(Object.keys(IMPLEMENTATIONS).sort()).toEqual(ids);
	});

	it.each(operations.map((o) => [o.id, o] as const))(
		"%s sends the method, path and required query of the contract",
		async (id, op) => {
			const impl = IMPLEMENTATIONS[id];
			expect(impl, `${id} is not implemented`).toBeDefined();
			const seen: Array<{ url: URL; init: RequestInit }> = [];
			const corvo = new Corvo({
				apiKey: API_KEY,
				baseUrl: BASE_URL,
				fetch: async (url, init) => {
					seen.push({ url: new URL(url), init: init ?? {} });
					if (op.status === 204) return new Response(null, { status: 204 });
					return new Response(
						JSON.stringify({
							data: [],
							pagination: { limit: 50, hasMore: false, nextCursor: null },
						}),
						{
							status: op.status,
							headers: { "content-type": "application/json" },
						},
					);
				},
			});
			await impl.call(corvo);
			expect(seen).toHaveLength(1);
			const expectedPath = op.path.replace(/\{(\w+)\}/g, (_m, name: string) => {
				const value = impl.params?.[name];
				expect(value, `${id}: no value for {${name}}`).toBeDefined();
				return encodeURIComponent(value as string);
			});
			expect(seen[0].init.method).toBe(op.method);
			expect(seen[0].url.pathname).toBe(`/v1${expectedPath}`);
			for (const name of op.requiredQuery) {
				expect(seen[0].url.searchParams.has(name), `${id}: query ${name}`).toBe(true);
			}
			const headers = seen[0].init.headers as Record<string, string>;
			expect(headers["X-API-Key"]).toBe(API_KEY);
		},
	);

	it("WEBHOOK_EVENTS equals the WebhookEventType enum of the contract", () => {
		const contract = spec.components.schemas.WebhookEventType.enum ?? [];
		expect([...WEBHOOK_EVENTS].sort()).toEqual([...contract].sort());
		expect(contract).toHaveLength(12);
	});
});
