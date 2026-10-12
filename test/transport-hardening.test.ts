import { describe, expect, it, vi } from "vitest";
import { HttpTransport } from "../src/transport";
import { API_KEY, BASE_URL, jsonResponse } from "./helpers";

function make(fetchMock?: (url: string, init?: RequestInit) => Promise<Response>): HttpTransport {
	return new HttpTransport({
		apiKey: API_KEY,
		baseUrl: BASE_URL,
		fetch: fetchMock ?? (async () => jsonResponse({ data: null })),
	});
}

describe("HttpTransport hardening", () => {
	it("rejects http:// public hosts at construction", () => {
		expect(
			() =>
				new HttpTransport({
					apiKey: API_KEY,
					baseUrl: "http://api.exemplo.com",
					fetch: async () => jsonResponse({ data: null }),
				}),
		).toThrow(/allowInsecureHttp/);
	});

	it("accepts http:// on loopback and private networks", () => {
		for (const baseUrl of [
			"http://localhost:4000",
			"http://127.0.0.1:3000",
			"http://192.168.0.10",
			"http://10.1.2.3",
			"http://172.16.0.9",
		]) {
			expect(
				() =>
					new HttpTransport({
						apiKey: API_KEY,
						baseUrl,
						fetch: async () => jsonResponse({ data: null }),
					}),
			).not.toThrow();
		}
	});

	it("accepts public http:// with allowInsecureHttp: true", () => {
		expect(
			() =>
				new HttpTransport({
					apiKey: API_KEY,
					baseUrl: "http://api.exemplo.com",
					allowInsecureHttp: true,
					fetch: async () => jsonResponse({ data: null }),
				}),
		).not.toThrow();
	});

	it("maps network rejections to network_error", async () => {
		const http = make(async () => {
			throw new TypeError("fetch failed");
		});
		const res = await http.request({ method: "GET", path: "/companies" });
		expect(res.error?.code).toBe("network_error");
		expect(res.error?.status).toBe(0);
		expect(res.error?.message).toContain("fetch failed");
	});

	it("aborts after timeoutMs and returns timeout", async () => {
		const http = new HttpTransport({
			apiKey: API_KEY,
			baseUrl: BASE_URL,
			timeoutMs: 10,
			fetch: (_url, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(new DOMException("This operation was aborted", "AbortError"));
					});
				}),
		});
		const res = await http.request({ method: "GET", path: "/companies" });
		expect(res.error?.code).toBe("timeout");
		expect(res.error?.status).toBe(0);
	});

	it("sends FormData without manual Content-Type (fetch sets multipart boundary)", async () => {
		const calls: Array<{ body: unknown; headers: Record<string, string> }> = [];
		const http = make(async (_url, init) => {
			calls.push({ body: init?.body, headers: (init?.headers ?? {}) as Record<string, string> });
			return jsonResponse({ data: { id: "cert_1" } });
		});
		const form = new FormData();
		form.append(
			"file",
			new Blob([new Uint8Array([1, 2, 3])], { type: "application/x-pkcs12" }),
			"cert.p12",
		);
		form.append("password", "segredo");
		await http.request({ method: "POST", path: "/companies/x/certificates", body: form });
		expect(calls[0].body).toBeInstanceOf(FormData);
		expect(calls[0].headers["Content-Type"]).toBeUndefined();
		const sent = calls[0].body as FormData;
		expect(sent.get("password")).toBe("segredo");
		const file = sent.get("file");
		expect(file).toBeInstanceOf(Blob);
		expect((file as File).name).toBe("cert.p12");
	});

	it("requestRaw returns buffer, mimeType and fileName", async () => {
		const http = make(
			async () =>
				new Response("%PDF-1.7 conteudo", {
					status: 200,
					headers: {
						"content-type": "application/pdf",
						"content-disposition": 'attachment; filename="nfse-12345.pdf"',
					},
				}),
		);
		const res = await http.requestRaw({ method: "GET", path: "/invoices/inv_1/pdf" });
		expect(res.error).toBeUndefined();
		expect(res.data?.buffer.toString("utf8")).toBe("%PDF-1.7 conteudo");
		expect(res.data?.mimeType).toBe("application/pdf");
		expect(res.data?.fileName).toBe("nfse-12345.pdf");
	});

	it("returns invalid_json when response is not JSON", async () => {
		const http = make(async () => new Response("<html>erro</html>", { status: 200 }));
		const res = await http.request({ method: "GET", path: "/companies" });
		expect(res.error?.code).toBe("invalid_json");
		expect(res.error?.status).toBe(200);
	});
});
