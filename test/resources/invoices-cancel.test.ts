import { describe, expect, it } from "vitest";
import { Corvo } from "../../src/client";
import { INVOICE_CANCELLATION_REASONS, type Invoice } from "../../src/index";
import { API_KEY, BASE_URL, jsonResponse } from "../helpers";

const ID = "f0add80b-5026-4a11-8f00-5fa03be98b5b";

const base = {
	id: ID,
	companyId: "09947127-2702-4f6d-9da8-cb463608d812",
	tenantId: "6247dfd9-0adc-4bf6-aac9-ee9dc1e7ca8b",
	environment: "test",
	status: "authorized",
	nfseNumber: 1001,
	lastErrorCode: null,
	lastErrorMessage: null,
	cancellationReason: null,
	cancellationDescription: null,
	cancelledAt: null,
	cancellationRequestedAt: null,
	createdAt: "2026-10-12T13:04:38.985Z",
	updatedAt: "2026-10-12T13:04:42.000Z",
};

const cancelled = {
	...base,
	status: "cancelled",
	cancellationReason: "issue_error",
	cancellationDescription: "Wrong amount on the invoice",
	cancelledAt: "2026-10-20T10:00:00.000Z",
	cancellationRequestedAt: "2026-10-20T09:59:58.000Z",
};

const cancelling = {
	...base,
	status: "cancelling",
	cancellationReason: "service_not_provided",
	cancellationDescription: "Service was never delivered",
	cancellationRequestedAt: "2026-10-20T09:59:58.000Z",
};

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

describe("invoices.cancel", () => {
	it("exposes the cancellation reasons", () => {
		expect(INVOICE_CANCELLATION_REASONS).toEqual(["issue_error", "service_not_provided", "other"]);
	});

	it("POSTs reason and description to /invoices/{id}/cancel and returns the cancelled invoice (200)", async () => {
		const { corvo, calls } = client(() => jsonResponse({ data: cancelled }));
		const res = await corvo.invoices.cancel(ID, {
			reason: "issue_error",
			description: "Wrong amount on the invoice",
		});
		expect(res.error).toBeUndefined();
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe(`http://localhost:4000/v1/invoices/${ID}/cancel`);
		expect(calls[0].init.method).toBe("POST");
		expect(JSON.parse(String(calls[0].init.body))).toEqual({
			reason: "issue_error",
			description: "Wrong amount on the invoice",
		});
		const invoice: Invoice | undefined = res.data;
		expect(invoice?.status).toBe("cancelled");
		expect(invoice?.cancelledAt).toBe("2026-10-20T10:00:00.000Z");
		expect(invoice?.cancellationReason).toBe("issue_error");
	});

	it("sends only the reason when no description is given", async () => {
		const { corvo, calls } = client(() => jsonResponse({ data: cancelled }));
		await corvo.invoices.cancel(ID, { reason: "other" });
		expect(JSON.parse(String(calls[0].init.body))).toEqual({ reason: "other" });
	});

	it("encodes the id in the path", async () => {
		const { corvo, calls } = client(() => jsonResponse({ data: cancelled }));
		await corvo.invoices.cancel("a/b", { reason: "other" });
		expect(calls[0].url).toBe("http://localhost:4000/v1/invoices/a%2Fb/cancel");
	});

	it("returns the cancelling invoice on 202", async () => {
		const { corvo } = client(() => jsonResponse({ data: cancelling }, { status: 202 }));
		const res = await corvo.invoices.cancel(ID, {
			reason: "service_not_provided",
			description: "Service was never delivered",
		});
		expect(res.error).toBeUndefined();
		expect(res.data?.status).toBe("cancelling");
		expect(res.data?.cancelledAt).toBeNull();
		expect(res.data?.cancellationRequestedAt).toBe("2026-10-20T09:59:58.000Z");
	});

	it("returns a processing invoice with cancellationRequestedAt on 202", async () => {
		const processing = {
			...base,
			status: "processing",
			cancellationReason: "other",
			cancellationDescription: "Customer gave up the order",
			cancellationRequestedAt: "2026-10-20T09:59:58.000Z",
		};
		const { corvo } = client(() => jsonResponse({ data: processing }, { status: 202 }));
		const res = await corvo.invoices.cancel(ID, {
			reason: "other",
			description: "Customer gave up the order",
		});
		expect(res.data?.status).toBe("processing");
		expect(res.data?.cancellationRequestedAt).toBe("2026-10-20T09:59:58.000Z");
	});

	it("surfaces 409 ERROR_INVOICE_NOT_CANCELLABLE as a CorvoApiError", async () => {
		const { corvo } = client(() =>
			jsonResponse(
				{
					statusCode: 409,
					code: "ERROR_INVOICE_NOT_CANCELLABLE",
					message: "Invoice cannot be cancelled in its current status",
					requestId: "req-409",
				},
				{ status: 409 },
			),
		);
		const res = await corvo.invoices.cancel(ID, { reason: "issue_error" });
		expect(res.data).toBeUndefined();
		expect(res.error?.name).toBe("CorvoApiError");
		expect(res.error?.status).toBe(409);
		expect(res.error?.code).toBe("ERROR_INVOICE_NOT_CANCELLABLE");
		expect(res.error?.requestId).toBe("req-409");
	});

	it("surfaces 422 description errors with field details", async () => {
		const { corvo } = client(() =>
			jsonResponse(
				{
					statusCode: 422,
					code: "ERROR_VALIDATION",
					message: "Request validation failed",
					details: [
						{ field: "description", code: "ERROR_INVALID_LENGTH", message: "15-255 characters" },
					],
				},
				{ status: 422 },
			),
		);
		const res = await corvo.invoices.cancel(ID, { reason: "issue_error", description: "short" });
		expect(res.error?.status).toBe(422);
		expect(res.error?.details?.[0].field).toBe("description");
	});
});

describe("invoices.get with cancellation states", () => {
	it("parses a cancelled invoice and the cancellation fields", async () => {
		const { corvo } = client(() => jsonResponse({ data: cancelled }));
		const res = await corvo.invoices.get(ID);
		expect(res.error).toBeUndefined();
		expect(res.data?.status).toBe("cancelled");
		expect(res.data?.cancellationReason).toBe("issue_error");
		expect(res.data?.cancellationDescription).toBe("Wrong amount on the invoice");
		expect(res.data?.cancelledAt).toBe("2026-10-20T10:00:00.000Z");
		expect(res.data?.cancellationRequestedAt).toBe("2026-10-20T09:59:58.000Z");
	});

	it("parses a cancelling invoice", async () => {
		const { corvo } = client(() => jsonResponse({ data: cancelling }));
		const res = await corvo.invoices.get(ID);
		expect(res.error).toBeUndefined();
		expect(res.data?.status).toBe("cancelling");
		expect(res.data?.cancellationReason).toBe("service_not_provided");
		expect(res.data?.cancelledAt).toBeNull();
	});

	it("parses cancelled invoices in a list", async () => {
		const { corvo } = client(() =>
			jsonResponse({
				data: [cancelled, cancelling],
				pagination: { limit: 50, hasMore: false, nextCursor: null },
			}),
		);
		const res = await corvo.invoices.list({ status: "cancelled" });
		expect(res.data?.data.map((i) => i.status)).toEqual(["cancelled", "cancelling"]);
	});
});
