import { describe, expect, it } from "vitest";
import { Corvo } from "../../src/client";
import { API_KEY, BASE_URL, jsonResponse } from "../helpers";

function client(fetch: (url: string, init?: RequestInit) => Promise<Response>): Corvo {
	return new Corvo({ apiKey: API_KEY, baseUrl: BASE_URL, fetch });
}

describe("invoices downloads and email", () => {
	it("pdf fetches the binary with mime type and file name", async () => {
		const corvo = client(
			async () =>
				new Response("%PDF-1.7 fake", {
					status: 200,
					headers: {
						"content-type": "application/pdf",
						"content-disposition": 'attachment; filename="nfse-1001.pdf"',
					},
				}),
		);
		const res = await corvo.invoices.pdf("inv_1");
		expect(res.error).toBeUndefined();
		expect(res.data?.buffer.toString("utf8")).toBe("%PDF-1.7 fake");
		expect(res.data?.mimeType).toBe("application/pdf");
		expect(res.data?.fileName).toBe("nfse-1001.pdf");
	});

	it("xml fetches the XML body", async () => {
		const corvo = client(
			async () =>
				new Response("<procNFe></procNFe>", {
					status: 200,
					headers: {
						"content-type": "application/xml",
						"content-disposition": 'attachment; filename="nfse-1001.xml"',
					},
				}),
		);
		const res = await corvo.invoices.xml("inv_1");
		expect(res.data?.buffer.toString("utf8")).toContain("procNFe");
		expect(res.data?.mimeType).toBe("application/xml");
	});

	it("pdf surfaces API errors (invoice not authorized)", async () => {
		const corvo = client(async () =>
			jsonResponse(
				{
					statusCode: 409,
					code: "ERROR_INVOICE_NOT_AVAILABLE",
					message: "PDF only after authorization",
				},
				{ status: 409 },
			),
		);
		const res = await corvo.invoices.pdf("inv_1");
		expect(res.data).toBeUndefined();
		expect(res.error?.code).toBe("ERROR_INVOICE_NOT_AVAILABLE");
		expect(res.error?.status).toBe(409);
	});

	it("downloadUrl POSTs the format and returns the signed URL", async () => {
		const calls: Array<{ url: string; init: RequestInit }> = [];
		const corvo = client(async (url, init) => {
			calls.push({ url, init: init ?? {} });
			return jsonResponse({
				data: {
					downloadUrl: "https://storage.example.com/nfse-1001.pdf?sig=abc",
					expiresAt: "2026-10-12T17:00:00.000Z",
					fileName: "nfse-1001.pdf",
					mimeType: "application/pdf",
				},
			});
		});
		const res = await corvo.invoices.downloadUrl("inv_1", "pdf");
		expect(res.data?.downloadUrl).toContain("sig=abc");
		expect(calls[0].init.method).toBe("POST");
		expect(JSON.parse(String(calls[0].init.body))).toEqual({ format: "pdf" });
	});

	it("sendEmail POSTs with Idempotency-Key and returns emailId", async () => {
		const calls: Array<{ url: string; init: RequestInit }> = [];
		const corvo = client(async (url, init) => {
			calls.push({ url, init: init ?? {} });
			return jsonResponse({ data: { emailId: "em_1", status: "queued" } }, { status: 202 });
		});
		const res = await corvo.invoices.sendEmail("inv_1", { idempotencyKey: "mail-1" });
		expect(res.data).toEqual({ emailId: "em_1", status: "queued" });
		expect(calls[0].url).toBe("http://localhost:4000/v1/invoices/inv_1/email");
		const headers = calls[0].init.headers as Record<string, string>;
		expect(headers["Idempotency-Key"]).toBe("mail-1");
	});
});
