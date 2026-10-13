import { describe, expect, it } from "vitest";
import { Corvo } from "../../src/client";
import { API_KEY, BASE_URL, jsonResponse } from "../helpers";

const webhook = {
	id: "46ee05ce-9dd6-47b7-8261-28061ec627c8",
	url: "https://webhook.site/eb9651dd",
	events: ["nfse.invoice.authorized", "nfse.invoice.rejected"],
	active: true,
	createdAt: "2026-10-11T00:35:38.843Z",
	updatedAt: "2026-10-11T00:35:38.843Z",
};

const delivery = {
	id: "84018385-f25d-463d-af23-cea43d0671d2",
	tenantId: "6247dfd9-0adc-4bf6-aac9-ee9dc1e7ca8b",
	webhookConfigId: webhook.id,
	eventType: "nfse.invoice.email_sent",
	environment: "test",
	url: webhook.url,
	payload: { id: "evt_1", type: "nfse.invoice.email_sent" },
	statusCode: 200,
	responseBody: null,
	errorMessage: null,
	status: "sent",
	durationMs: 1535,
	retryCount: 0,
	nextRetryAt: null,
	lastError: null,
	createdAt: "2026-10-12T13:04:51.575Z",
};

function client(fetch: (url: string, init?: RequestInit) => Promise<Response>): Corvo {
	return new Corvo({ apiKey: API_KEY, baseUrl: BASE_URL, fetch });
}

describe("webhooks", () => {
	it("list returns a paginated plain list", async () => {
		const corvo = client(async () =>
			jsonResponse({ data: [webhook], pagination: { limit: 1, hasMore: false, nextCursor: null } }),
		);
		const res = await corvo.webhooks.list({ limit: 1 });
		expect(res.data?.data[0].url).toBe(webhook.url);
		expect(res.data?.pagination.hasMore).toBe(false);
	});

	it("create POSTs url/events and returns the secret once", async () => {
		const calls: Array<{ url: string; init: RequestInit }> = [];
		const corvo = client(async (url, init) => {
			calls.push({ url, init: init ?? {} });
			return jsonResponse({ data: { ...webhook, secret: "whsec_abc" } }, { status: 201 });
		});
		const res = await corvo.webhooks.create({
			url: webhook.url,
			events: ["nfse.invoice.authorized", "nfse.invoice.rejected"],
		});
		expect(res.data?.secret).toBe("whsec_abc");
		expect(calls[0].url).toBe("http://localhost:4000/v1/webhooks");
		expect(JSON.parse(String(calls[0].init.body)).events).toHaveLength(2);
	});

	it("remove and test return their boolean flags", async () => {
		let call = 0;
		const methods: string[] = [];
		const corvo = client(async (_url, init) => {
			methods.push(init?.method ?? "GET");
			call++;
			return jsonResponse({ data: call === 1 ? { deleted: true } : { sent: true } });
		});
		const removed = await corvo.webhooks.remove(webhook.id);
		const tested = await corvo.webhooks.test(webhook.id);
		expect(removed.data).toEqual({ deleted: true });
		expect(tested.data).toEqual({ sent: true });
		expect(methods).toEqual(["DELETE", "POST"]);
	});

	it("deliveries.list sends hours/environment/limit and parses pagination", async () => {
		const urls: string[] = [];
		const corvo = client(async (url) => {
			urls.push(url);
			return jsonResponse({
				data: [delivery],
				pagination: { limit: 10, hasMore: true, nextCursor: "dc1" },
			});
		});
		const res = await corvo.webhooks.deliveries.list({ hours: 24, environment: "test", limit: 10 });
		expect(res.data?.data[0].status).toBe("sent");
		expect(res.data?.pagination.nextCursor).toBe("dc1");
		expect(urls[0]).toContain("hours=24");
		expect(urls[0]).toContain("environment=test");
		expect(urls[0]).toContain("limit=10");
	});

	it("deliveries.stats returns the counters and retry flags the retry", async () => {
		let call = 0;
		const corvo = client(async () => {
			call++;
			if (call === 1)
				return jsonResponse({ data: { total: 3, sent: 3, failed: 0, pending: 0, delayed: 0 } });
			return jsonResponse({ data: { retried: true } });
		});
		const stats = await corvo.webhooks.deliveries.stats({ hours: 24 });
		expect(stats.data).toEqual({ total: 3, sent: 3, failed: 0, pending: 0, delayed: 0 });
		const retry = await corvo.webhooks.deliveries.retry("dlv_1");
		expect(retry.data).toEqual({ retried: true });
	});
});
