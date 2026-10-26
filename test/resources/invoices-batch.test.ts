import { describe, expect, it } from "vitest";
import { Corvo } from "../../src/client";
import { API_KEY, BASE_URL, jsonResponse } from "../helpers";

type Call = { url: string; init: RequestInit };

function client(handler: (call: Call) => Response): { corvo: Corvo; calls: Call[] } {
	const calls: Call[] = [];
	const corvo = new Corvo({
		apiKey: API_KEY,
		baseUrl: BASE_URL,
		fetch: async (url, init) => {
			const call = { url, init: init ?? {} };
			calls.push(call);
			return handler(call);
		},
	});
	return { corvo, calls };
}

const summary = {
	total: 3,
	accepted: 2,
	rejected: 1,
	results: [
		{ index: 0, status: "accepted", invoice: { id: "a", status: "queued", amount: 150.5 } },
		{
			index: 1,
			status: "accepted",
			replayed: true,
			invoice: { id: "b", status: "queued", amount: 300 },
		},
		{
			index: 2,
			status: "rejected",
			error: {
				code: "ERROR_VALIDATION",
				message: "Request validation failed",
				details: [
					{ field: "amount", code: "ERROR_OUT_OF_RANGE", message: "amount must be greater than 0" },
				],
			},
		},
	],
};

describe("invoices.createBatch", () => {
	it("posts { invoices } to /invoices/batches, per-item keys, no Idempotency-Key header", async () => {
		const { corvo, calls } = client(() => jsonResponse({ data: summary }, { status: 202 }));
		const res = await corvo.invoices.createBatch([
			{
				companyTaxId: "11222333000181",
				idempotencyKey: "sheet-row-2",
				service: { description: "Consultoria" },
				amount: 150.5,
				deduction: 20,
				competenceDate: "2026-10-01",
			},
			{
				companyTaxId: "11222333000181",
				idempotencyKey: "sheet-row-3",
				service: { description: "Manutenção" },
				amount: 300,
				competenceDate: "2026-10-01",
			},
		]);
		expect(res.error).toBeUndefined();
		expect(calls[0].url).toBe("http://localhost:4000/v1/invoices/batches");
		expect(calls[0].init.method).toBe("POST");
		const headers = new Headers(calls[0].init.headers);
		expect(headers.has("idempotency-key")).toBe(false);
		const body = JSON.parse(String(calls[0].init.body));
		expect(body.invoices).toHaveLength(2);
		expect(body.invoices[0].idempotencyKey).toBe("sheet-row-2");
		expect(body.invoices[0].deduction).toBe(20);
	});

	it("unwraps the summary and keeps accepted, replayed and rejected results", async () => {
		const { corvo } = client(() => jsonResponse({ data: summary }, { status: 202 }));
		const res = await corvo.invoices.createBatch([]);
		expect(res.data?.total).toBe(3);
		expect(res.data?.results[1].replayed).toBe(true);
		expect(res.data?.results[2].error?.details).toBeDefined();
	});

	it("returns the typed error when the whole batch is invalid", async () => {
		const { corvo } = client(() =>
			jsonResponse(
				{
					statusCode: 400,
					code: "ERROR_VALIDATION",
					message: "Request validation failed",
					requestId: "r1",
				},
				{ status: 400 },
			),
		);
		const res = await corvo.invoices.createBatch([]);
		expect(res.error?.code).toBe("ERROR_VALIDATION");
		expect(res.error?.status).toBe(400);
	});
});
