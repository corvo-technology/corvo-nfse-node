import { afterEach, describe, expect, it, vi } from "vitest";
import { Corvo } from "../src/client";
import { API_KEY, jsonResponse } from "./helpers";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("Corvo", () => {
	it("throws on construction without apiKey", () => {
		vi.stubEnv("CORVO_API_KEY", "");
		expect(() => new Corvo({ baseUrl: "http://localhost:4000" })).toThrow(/apiKey/);
	});

	it("reads CORVO_API_KEY and CORVO_BASE_URL from environment", async () => {
		vi.stubEnv("CORVO_API_KEY", `corvo_live_${"b".repeat(40)}`);
		vi.stubEnv("CORVO_BASE_URL", "https://instalacao.exemplo.com");
		const seen: string[] = [];
		const corvo = new Corvo({
			fetch: async (url: string) => {
				seen.push(url);
				return jsonResponse({ status: "ok" });
			},
		});
		await corvo.health.live();
		expect(seen[0]).toBe("https://instalacao.exemplo.com/v1/health/live");
	});

	it("uses https://api.corvo.tech as default baseUrl", async () => {
		vi.stubEnv("CORVO_BASE_URL", "");
		vi.stubEnv("CORVO_API_KEY", "");
		const seen: string[] = [];
		const corvo = new Corvo({
			apiKey: API_KEY,
			fetch: async (url: string) => {
				seen.push(url);
				return jsonResponse({ status: "ok" });
			},
		});
		await corvo.health.ready();
		expect(seen[0]).toBe("https://api.corvo.tech/v1/health/ready");
	});

	it("health.live returns the raw object (no data envelope)", async () => {
		const corvo = new Corvo({
			apiKey: API_KEY,
			baseUrl: "http://localhost:4000",
			fetch: async () =>
				jsonResponse({ status: "ok", timestamp: "2026-10-12T16:04:48.268Z", uptime: 10867 }),
		});
		const res = await corvo.health.live();
		expect(res.error).toBeUndefined();
		expect(res.data).toEqual({
			status: "ok",
			timestamp: "2026-10-12T16:04:48.268Z",
			uptime: 10867,
		});
	});
});
