import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildClient, configPath, readConfig, writeConfig } from "../../src/cli/config";

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "corvo-config-"));
	vi.stubEnv("CORVO_CONFIG_PATH", join(dir, "config.json"));
	vi.stubEnv("CORVO_API_KEY", "");
	vi.stubEnv("CORVO_BASE_URL", "");
});

afterEach(() => {
	vi.unstubAllEnvs();
	rmSync(dir, { recursive: true, force: true });
});

describe("cli config", () => {
	it("reads and writes the config file with 0600 permissions", () => {
		expect(readConfig()).toEqual({});
		writeConfig({ apiKey: `corvo_test_${"a".repeat(40)}`, baseUrl: "https://corvo.example.com" });
		const onDisk = JSON.parse(readFileSync(configPath(), "utf8"));
		expect(onDisk.apiKey).toContain("corvo_test_");
		expect(statSync(configPath()).mode & 0o777).toBe(0o600);
		expect(readConfig().baseUrl).toBe("https://corvo.example.com");
		writeConfig({ baseUrl: "https://outra.exemplo.com" });
		expect(readConfig().apiKey).toContain("corvo_test_");
		expect(readConfig().baseUrl).toBe("https://outra.exemplo.com");
	});

	it("buildClient precedence: flags > env > config file", () => {
		writeConfig({ apiKey: `corvo_test_${"f".repeat(40)}`, baseUrl: "https://config.exemplo.com" });
		vi.stubEnv("CORVO_API_KEY", `corvo_test_${"e".repeat(40)}`);
		vi.stubEnv("CORVO_BASE_URL", "https://env.exemplo.com");

		const fromFile = buildClient({});
		expect(fromFile).toBeDefined();

		const fromFlags = buildClient({
			apiKey: `corvo_live_${"c".repeat(40)}`,
			baseUrl: "http://localhost:4000",
		});
		expect(fromFlags).toBeDefined();

		vi.unstubAllEnvs();
		vi.stubEnv("CORVO_CONFIG_PATH", join(dir, "config.json"));
		const onlyFile = buildClient({ apiKey: `corvo_test_${"a".repeat(40)}` });
		expect(onlyFile).toBeDefined();
	});

	it("throws without any apiKey source", () => {
		expect(() => buildClient({})).toThrow(/apiKey/);
	});
});
