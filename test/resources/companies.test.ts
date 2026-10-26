import { describe, expect, it } from "vitest";
import { Corvo } from "../../src/client";
import { API_KEY, BASE_URL, jsonResponse } from "../helpers";

const company = {
	id: "09947127-2702-4f6d-9da8-cb463608d812",
	tenantId: "6247dfd9-0adc-4bf6-aac9-ee9dc1e7ca8b",
	legalName: "Empresa Exemplo Tecnologia LTDA",
	tradeName: "Empresa Exemplo TESTE",
	taxId: "41834687000148",
	municipalReg: "123456",
	municipalityCode: "3170206",
	taxRegime: "Simples Nacional",
	simpleNational: true,
	specialRegime: null,
	addressStreet: "Rua Exemplo de Testes",
	addressNumber: "100",
	addressComplement: null,
	addressDistrict: "Centro",
	addressCity: "Uberlândia",
	addressState: "MG",
	addressZip: "38400000",
	fiscalSchemaVersion: "v2_02",
	environment: "test",
	status: "ready",
	createdAt: "2026-10-12T13:04:38.985Z",
	updatedAt: "2026-10-12T13:04:40.230Z",
	deletedAt: null,
	setupGaps: [],
};

function client(fetch: (url: string, init?: RequestInit) => Promise<Response>): Corvo {
	return new Corvo({ apiKey: API_KEY, baseUrl: BASE_URL, fetch });
}

describe("companies", () => {
	it("create POSTs /companies with input and returns Company", async () => {
		const calls: Array<{ url: string; init: RequestInit }> = [];
		const corvo = client(async (url, init) => {
			calls.push({ url, init: init ?? {} });
			return jsonResponse({ data: company }, { status: 201 });
		});
		const res = await corvo.companies.create({
			legalName: company.legalName,
			taxId: "41.834.687/0001-48",
			taxRegime: "Simples Nacional",
			simplesRate: "6.54",
			simplesIssRate: "3.00",
			municipalityCode: "3550308",
			address: {
				street: "Rua Exemplo",
				number: "100",
				district: "Centro",
				city: "Uberlândia",
				state: "MG",
				zip: "38400-000",
			},
		});
		expect(res.error).toBeUndefined();
		expect(res.data?.id).toBe(company.id);
		expect(calls[0].url).toBe("http://localhost:4000/v1/companies");
		expect(calls[0].init.method).toBe("POST");
		const body = JSON.parse(String(calls[0].init.body));
		expect(body.taxRegime).toBe("Simples Nacional");
		expect(body.simplesRate).toBe("6.54");
		expect(body.simplesIssRate).toBe("3.00");
		expect(body.address.city).toBe("Uberlândia");
	});

	it("list returns Paginated with the API real pagination", async () => {
		const corvo = client(async () =>
			jsonResponse({
				data: [company],
				pagination: { limit: 2, hasMore: false, nextCursor: null },
			}),
		);
		const res = await corvo.companies.list({ limit: 2 });
		expect(res.error).toBeUndefined();
		expect(res.data?.data).toHaveLength(1);
		expect(res.data?.pagination).toEqual({ limit: 2, hasMore: false, nextCursor: null });
	});

	it("get, update and remove", async () => {
		const methods: string[] = [];
		const corvo = client(async (_url, init) => {
			methods.push(init?.method ?? "GET");
			if ((init?.method ?? "GET") === "DELETE") return new Response(null, { status: 204 });
			return jsonResponse({ data: company });
		});
		const got = await corvo.companies.get(company.id);
		expect(got.data?.legalName).toBe(company.legalName);

		const updated = await corvo.companies.update(company.id, { municipalReg: null });
		expect(updated.error).toBeUndefined();

		const removed = await corvo.companies.remove(company.id);
		expect(removed.data).toBeNull();
		expect(methods).toEqual(["GET", "PATCH", "DELETE"]);
	});

	it("iterate walks the pages", async () => {
		const pages = [
			jsonResponse({
				data: [company],
				pagination: { limit: 1, hasMore: true, nextCursor: "c1" },
			}),
			jsonResponse({
				data: [{ ...company, id: "outra" }],
				pagination: { limit: 1, hasMore: false, nextCursor: null },
			}),
		];
		let i = 0;
		const corvo = client(async () => pages[Math.min(i++, pages.length - 1)]);
		const ids: string[] = [];
		for await (const item of corvo.companies.iterate({ limit: 1 })) ids.push(item.id);
		expect(ids).toEqual([company.id, "outra"]);
	});
});
