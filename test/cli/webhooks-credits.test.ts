import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../../src/cli/program";
import { API_KEY, BASE_URL, jsonResponse } from "../helpers";

let stdout: string[];
let stderr: string[];
let outSpy: { mockRestore(): void };
let errSpy: { mockRestore(): void };

beforeEach(() => {
	stdout = [];
	stderr = [];
	outSpy = vi.spyOn(process.stdout, "write").mockImplementation(((chunk: string | Uint8Array) => {
		stdout.push(String(chunk));
		return true;
	}) as typeof process.stdout.write);
	errSpy = vi.spyOn(process.stderr, "write").mockImplementation(((chunk: string | Uint8Array) => {
		stderr.push(String(chunk));
		return true;
	}) as typeof process.stderr.write);
	vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
		throw new Error(`exit:${code}`);
	}) as never);
	vi.stubEnv("CORVO_API_KEY", API_KEY);
	vi.stubEnv("CORVO_BASE_URL", BASE_URL);
	vi.stubEnv("CORVO_CONFIG_PATH", join(mkdtempSync(join(tmpdir(), "corvo-cli-")), "config.json"));
});

afterEach(() => {
	outSpy.mockRestore();
	errSpy.mockRestore();
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

async function run(...args: string[]): Promise<void> {
	await createProgram().parseAsync(args, { from: "user" });
}

describe("cli webhooks", () => {
	it("creates a webhook from flags", async () => {
		let body: Record<string, unknown> = {};
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string, init?: RequestInit) => {
				body = JSON.parse(String(init?.body));
				return jsonResponse(
					{
						data: {
							id: "wh_1",
							url: "https://exemplo.com/hook",
							events: body.events,
							active: true,
							createdAt: "x",
							updatedAt: "x",
							secret: "whsec_abc",
						},
					},
					{ status: 201 },
				);
			}),
		);
		await run(
			"webhooks",
			"create",
			"--url",
			"https://exemplo.com/hook",
			"--events",
			"nfse.invoice.authorized,webhook.test",
		);
		expect(body.url).toBe("https://exemplo.com/hook");
		expect(body.events).toEqual(["nfse.invoice.authorized", "webhook.test"]);
		expect(stdout.join("")).toContain("whsec_abc");
	});

	it("shows delivery stats as JSON", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse({ data: { total: 3, sent: 3, failed: 0, pending: 0, delayed: 0 } }),
			),
		);
		await run("webhooks", "deliveries", "stats", "--hours", "24", "--json");
		const parsed = JSON.parse(stdout.join(""));
		expect(parsed.total).toBe(3);
	});

	it("lists deliveries with environment filter", async () => {
		const urls: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string) => {
				urls.push(url);
				return jsonResponse({
					data: [],
					pagination: { limit: 50, hasMore: false, nextCursor: null },
				});
			}),
		);
		await run("webhooks", "deliveries", "list", "--environment", "test", "--json");
		expect(urls[0]).toContain("environment=test");
		const parsed = JSON.parse(stdout.join(""));
		expect(parsed.data).toEqual([]);
	});

	it("retries a delivery", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => jsonResponse({ data: { retried: true } })),
		);
		await run("webhooks", "deliveries", "retry", "dlv_1", "--json");
		expect(JSON.parse(stdout.join("")).retried).toBe(true);
	});

	it("removes a webhook with confirmation", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => jsonResponse({ data: { deleted: true } })),
		);
		await run("webhooks", "remove", "wh_1");
		expect(stdout.join("")).toContain("wh_1");
	});
});

describe("cli credits, billing and health", () => {
	it("prints the credit balance", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse({
					data: {
						tenantId: "t1",
						balance: 200,
						overageUnits: 0,
						overageAmountCents: 0,
						hardLimit: 1000,
					},
				}),
			),
		);
		await run("credits", "balance", "--json");
		expect(JSON.parse(stdout.join("")).balance).toBe(200);
	});

	it("lists plans as a table", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse({
					data: [{ id: "p1", slug: "free", name: "Free", dailyLimit: 3, active: true }],
					pagination: { limit: 50, hasMore: false, nextCursor: null },
				}),
			),
		);
		await run("credits", "plans");
		const text = stdout.join("");
		expect(text).toContain("slug");
		expect(text).toContain("free");
	});

	it("prints billing usage", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse({ data: { canEmit: true, creditsRemaining: 200, creditsUsed: 0 } }),
			),
		);
		await run("billing", "usage", "--json");
		expect(JSON.parse(stdout.join("")).canEmit).toBe(true);
	});

	it("prints raw health output", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse({ status: "ok", timestamp: "2026-10-12T16:04:48.268Z", uptime: 10 }),
			),
		);
		await run("health", "live", "--json");
		expect(JSON.parse(stdout.join("")).status).toBe("ok");
	});
});
