import { describe, expect, it, vi } from "vitest";
import { HttpTransport } from "../src/transport";
import { API_KEY, BASE_URL, jsonResponse } from "./helpers";

interface Capture {
	url: string;
	init: RequestInit;
}

function captureTransport(respond: (url: string, init: RequestInit) => Response): {
	http: HttpTransport;
	calls: Capture[];
} {
	const calls: Capture[] = [];
	const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
		calls.push({ url, init: init ?? {} });
		return respond(url, init ?? {});
	});
	const http = new HttpTransport({
		apiKey: API_KEY,
		baseUrl: `${BASE_URL}/`,
		fetch: fetchMock,
	});
	return { http, calls };
}

function headersOf(call: Capture): Record<string, string> {
	return call.init.headers as Record<string, string>;
}

describe("HttpTransport", () => {
	it("builds URL with v1 prefix, method, query and auth headers", async () => {
		const { http, calls } = captureTransport(() => jsonResponse({ data: { ok: true } }));
		const res = await http.request<{ ok: boolean }>({
			method: "GET",
			path: "/companies",
			query: { limit: 10, cursor: undefined },
		});
		expect(res.error).toBeUndefined();
		expect(res.data).toEqual({ ok: true });
		expect(calls[0].url).toBe("http://localhost:4000/v1/companies?limit=10");
		expect(calls[0].init.method).toBe("GET");
		expect(headersOf(calls[0])["X-API-Key"]).toBe(API_KEY);
		expect(headersOf(calls[0]).Accept).toBe("application/json");
	});

	it("sends JSON body and Idempotency-Key", async () => {
		const { http, calls } = captureTransport(() => jsonResponse({ data: { id: "inv_1" } }));
		await http.request({
			method: "POST",
			path: "/invoices",
			body: { amount: 10 },
			idempotencyKey: "pedido_123",
		});
		expect(headersOf(calls[0])["Content-Type"]).toBe("application/json");
		expect(headersOf(calls[0])["Idempotency-Key"]).toBe("pedido_123");
		expect(calls[0].init.body).toBe(JSON.stringify({ amount: 10 }));
	});

	it("unwraps data by default and none", async () => {
		// Deviation from plan: the plan's mock returned the same envelope for both
		// requests, so the unwrap:"none" body had no `pagination` key while the test
		// asserted it was truthy. The respond function is now path-aware.
		const { http } = captureTransport((url) =>
			url.endsWith("/invoices/x")
				? jsonResponse({ data: { id: "inv_1", status: "queued" } })
				: jsonResponse({
						data: [{ id: "inv_1" }],
						pagination: { limit: 50, hasMore: false, nextCursor: null },
					}),
		);
		const plain = await http.request<{ id: string }>({
			method: "GET",
			path: "/invoices/x",
		});
		expect(plain.data).toEqual({ id: "inv_1", status: "queued" });

		const none = await http.request<{ data: unknown; pagination: unknown }>({
			method: "GET",
			path: "/invoices",
			unwrap: "none",
		});
		expect(none.data?.data).toBeTruthy();
		expect(none.data?.pagination).toBeTruthy();
	});

	it("maps REST errors to CorvoApiError with code, details and requestId", async () => {
		const { http } = captureTransport(() =>
			jsonResponse(
				{
					statusCode: 400,
					code: "ERROR_VALIDATION",
					message: "Request validation failed",
					details: [
						{ field: "customer.taxId", code: "ERROR_INVALID_TAX_ID", message: "Invalid tax ID" },
					],
					requestId: "req-123",
				},
				{ status: 400 },
			),
		);
		const res = await http.request({ method: "POST", path: "/invoices", body: {} });
		expect(res.data).toBeUndefined();
		expect(res.error?.name).toBe("CorvoApiError");
		expect(res.error?.code).toBe("ERROR_VALIDATION");
		expect(res.error?.status).toBe(400);
		expect(res.error?.requestId).toBe("req-123");
		expect(res.error?.details?.[0].field).toBe("customer.taxId");
	});

	it("falls back to header X-Request-Id and http_<status> code when body has no code", async () => {
		const { http } = captureTransport(() =>
			jsonResponse(
				{ message: ["campo inválido"] },
				{ status: 422, headers: { "x-request-id": "hdr-9" } },
			),
		);
		const res = await http.request({ method: "GET", path: "/companies" });
		expect(res.error?.code).toBe("http_422");
		expect(res.error?.requestId).toBe("hdr-9");
		expect(res.error?.message).toBe("campo inválido");
	});

	it("reads Retry-After header on 429", async () => {
		const { http } = captureTransport(() =>
			jsonResponse(
				{ statusCode: 429, code: "ERROR_RATE_LIMITED", message: "slow down" },
				{
					status: 429,
					headers: { "retry-after": "45" },
				},
			),
		);
		const res = await http.request({ method: "GET", path: "/companies" });
		expect(res.error?.code).toBe("ERROR_RATE_LIMITED");
		expect(res.error?.retryAfter).toBe(45);
	});

	it("204 resolves to null", async () => {
		const { http } = captureTransport(() => new Response(null, { status: 204 }));
		const res = await http.request({ method: "DELETE", path: "/companies/x/certificates/y" });
		expect(res.error).toBeUndefined();
		expect(res.data).toBeNull();
	});
});
