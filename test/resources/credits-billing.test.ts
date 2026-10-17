import { describe, expect, it } from "vitest";
import { Corvo } from "../../src/client";
import { API_KEY, BASE_URL, jsonResponse } from "../helpers";

const creditPlan = {
	id: "f02dce85-e834-49c1-8f5b-adb0a06ec3d4",
	slug: "free",
	name: "Free",
	description: "Perfect for testing and small projects",
	dailyLimit: 3,
	maxActiveCompanies: 1,
	creditUnitPriceCents: 0,
	throughputRps: 10,
	includesWebhooks: true,
	includesXmlDownload: true,
	includesPdfDownload: true,
	includesApiKeys: true,
	supportTier: "community",
	active: true,
	createdAt: "2026-10-09T19:49:04.888Z",
	updatedAt: "2026-10-09T19:49:04.888Z",
};

function client(fetch: (url: string, init?: RequestInit) => Promise<Response>): Corvo {
	return new Corvo({ apiKey: API_KEY, baseUrl: BASE_URL, fetch });
}

describe("credits", () => {
	it("balance unwraps the real fields", async () => {
		const corvo = client(async () =>
			jsonResponse({
				data: {
					tenantId: "t_1",
					balance: 200,
					overageUnits: 0,
					overageAmountCents: 0,
					hardLimit: 1000,
				},
			}),
		);
		const res = await corvo.credits.balance();
		expect(res.data).toEqual({
			tenantId: "t_1",
			balance: 200,
			overageUnits: 0,
			overageAmountCents: 0,
			hardLimit: 1000,
		});
	});

	it("plans returns items from the cursor page", async () => {
		const corvo = client(async () =>
			jsonResponse({
				data: [creditPlan],
				pagination: { limit: 1, hasMore: false, nextCursor: null },
			}),
		);
		const res = await corvo.credits.plans();
		expect(res.data?.data[0].slug).toBe("free");
		expect(res.data?.pagination.hasMore).toBe(false);
	});

	it("history walks the cursor pages", async () => {
		const tx = {
			id: "tx_1",
			type: "topup",
			amount: 100,
			creditDelta: 100,
			balanceAfter: 200,
			environment: "test",
			source: "pack",
			referenceType: null,
			referenceId: null,
			createdAt: "2026-10-12T12:00:00.000Z",
		};
		const pages = [
			jsonResponse({
				data: [tx],
				pagination: { limit: 1, hasMore: true, nextCursor: "h1" },
			}),
			jsonResponse({ data: [], pagination: { limit: 1, hasMore: false, nextCursor: null } }),
		];
		let i = 0;
		const corvo = client(async () => pages[Math.min(i++, pages.length - 1)]);
		const items = [];
		for await (const entry of corvo.credits.iterateHistory({ limit: 1 })) items.push(entry);
		expect(items).toHaveLength(1);
		expect(items[0].id).toBe(tx.id);
	});
});

describe("billing", () => {
	it("plan returns the real snake_case payload", async () => {
		const payload = {
			plan: {
				slug: "developer",
				name: "Developer",
				monthly_allowance: 200,
				daily_limit: null,
				max_active_companies: 10,
				monthly_price_cents: 2990,
			},
			subscription: {
				status: "active",
				paid_until: "2026-11-12T12:25:41.000Z",
				cancel_at_period_end: false,
				scheduled_plan: null,
				blocked: false,
			},
			usage: { credits_remaining: 200, credits_used: 0 },
		};
		const corvo = client(async () => jsonResponse({ data: payload }));
		const res = await corvo.billing.plan();
		expect(res.data?.plan.slug).toBe("developer");
		expect(res.data?.subscription.status).toBe("active");
		expect(res.data?.usage.credits_remaining).toBe(200);
	});

	it("usage returns the camelCase QuotaStatus", async () => {
		const quota = {
			canEmit: true,
			creditsRemaining: 200,
			creditsUsed: 0,
			creditsReserved: 0,
			monthlyAllowance: 200,
			dailyUsage: 0,
			dailyLimit: null,
			activeCompanies: 0,
			maxActiveCompanies: 10,
			periodStart: "2026-10-12T12:25:41.000Z",
			periodEnd: "2026-11-12T12:25:41.000Z",
		};
		const corvo = client(async () => jsonResponse({ data: quota }));
		const res = await corvo.billing.usage();
		expect(res.data?.canEmit).toBe(true);
		expect(res.data?.creditsRemaining).toBe(200);
	});
});
