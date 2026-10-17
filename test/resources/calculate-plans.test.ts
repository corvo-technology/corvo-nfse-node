import { describe, expect, it } from "vitest";
import { Corvo } from "../../src/client";
import type { FetchLike } from "../../src/transport";
import { API_KEY, BASE_URL, jsonResponse } from "../helpers";

function client(fetch: FetchLike): Corvo {
	return new Corvo({ apiKey: API_KEY, baseUrl: BASE_URL, fetch });
}

describe("invoices.calculate", () => {
	it("POSTs /v1/invoices/calculate and returns the estimate without issuing", async () => {
		const calls: Array<{ url: string; init: RequestInit }> = [];
		const corvo = client(async (url, init) => {
			calls.push({ url, init: init ?? {} });
			return jsonResponse({
				data: {
					preEmission: true,
					status: "ready",
					taxes: {
						iss: { base: "15000.00", rate: "3", amount: "450.00" },
						ibsTotal: { base: "14550.00", amount: "14.55" },
					},
					netReceivableAmount: "15000.00",
					blocking: null,
				},
			});
		});
		const res = await corvo.invoices.calculate({
			companyTaxId: "11222333000181",
			service: {},
			amount: 15000,
			competenceDate: "2026-10-16",
		});
		expect(res.error).toBeUndefined();
		expect(res.data?.status).toBe("ready");
		expect(res.data?.taxes.iss?.amount).toBe("450.00");
		expect(res.data?.taxes.ibsTotal?.rate).toBeUndefined();
		expect(calls[0].url).toBe(`${BASE_URL}/v1/invoices/calculate`);
		expect(calls[0].init.method).toBe("POST");
	});

	it("returns a blocked estimate as data, not as an error", async () => {
		const corvo = client(async () =>
			jsonResponse({
				data: {
					status: "blocked",
					blocking: { code: "TAX_RATE_NOT_FOUND", message: "x", step: "LegacyTaxCalculator" },
					pendingFields: [{ field: "iss.rate", reason: "missing" }],
				},
			}),
		);
		const res = await corvo.invoices.calculate({
			companyTaxId: "11222333000181",
			service: {},
			amount: 10,
			competenceDate: "2026-10-16",
		});
		expect(res.error).toBeUndefined();
		expect(res.data?.blocking?.code).toBe("TAX_RATE_NOT_FOUND");
	});
});

describe("plans (public catalog)", () => {
	it("list returns a cursor page of price quotes", async () => {
		const corvo = client(async (url) => {
			expect(url).toBe(`${BASE_URL}/v1/plans?limit=5`);
			return jsonResponse({
				data: [
					{ slug: "developer", monthlyAllowance: 200, monthlyTotalCents: 2990, currency: "BRL" },
				],
				pagination: { limit: 5, hasMore: false, nextCursor: null },
			});
		});
		const res = await corvo.plans.list({ limit: 5 });
		expect(res.data?.data[0].slug).toBe("developer");
	});

	it("get and quote hit the right paths", async () => {
		const urls: string[] = [];
		const corvo = client(async (url) => {
			urls.push(url);
			return jsonResponse({
				data: url.includes("quote") ? { recommended_plan: "volume" } : { slug: "growth" },
			});
		});
		expect((await corvo.plans.get("growth")).data?.slug).toBe("growth");
		expect((await corvo.plans.quote(20000)).data?.recommended_plan).toBe("volume");
		expect(urls).toEqual([
			`${BASE_URL}/v1/plans/growth`,
			`${BASE_URL}/v1/plans/quote?volume=20000`,
		]);
	});
});
