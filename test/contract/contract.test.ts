import { describe, expect, it } from "vitest";
import { Corvo } from "../../src/index";

const enabled = Boolean(process.env.CORVO_API_KEY && process.env.CORVO_BASE_URL);

describe.skipIf(!enabled)("contract against a live instance", () => {
	it("reads health and a company page", async () => {
		const corvo = new Corvo();
		const live = await corvo.health.live();
		expect(live.error).toBeUndefined();
		expect((live.data as { status: string }).status).toBe("ok");

		const page = await corvo.companies.list({ limit: 1 });
		expect(page.error).toBeUndefined();
		expect(page.data?.pagination.limit).toBe(1);
		expect(Array.isArray(page.data?.data)).toBe(true);
	});
});
