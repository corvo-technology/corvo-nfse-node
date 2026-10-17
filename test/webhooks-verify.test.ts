import { describe, expect, it } from "vitest";
import { Corvo, CorvoApiError, WEBHOOK_EVENTS } from "../src/index";
import { CorvoWebhooks } from "../src/webhooks";

const BODY = '{"type":"nfse.invoice.authorized","data":{"id":"inv_1"}}';
const SECRET = "whsec_test_123";
const SIGNATURE = "sha256=8f9bd040d8f717b19618ab3395ddfa4b8c176b8dc863195227b88dd85426bbbc";

describe("CorvoWebhooks.verifySignature", () => {
	it("accepts the known HMAC-SHA256 vector", () => {
		expect(CorvoWebhooks.verifySignature(BODY, SIGNATURE, SECRET)).toBe(true);
		expect(CorvoWebhooks.verifySignature(Buffer.from(BODY), SIGNATURE, SECRET)).toBe(true);
	});

	it("rejects a tampered body", () => {
		const tampered = BODY.replace("inv_1", "inv_2");
		expect(CorvoWebhooks.verifySignature(tampered, SIGNATURE, SECRET)).toBe(false);
	});

	it("rejects a wrong secret", () => {
		expect(CorvoWebhooks.verifySignature(BODY, SIGNATURE, "whsec_other")).toBe(false);
	});

	it("rejects malformed headers", () => {
		expect(CorvoWebhooks.verifySignature(BODY, undefined, SECRET)).toBe(false);
		expect(CorvoWebhooks.verifySignature(BODY, null, SECRET)).toBe(false);
		expect(
			CorvoWebhooks.verifySignature(
				BODY,
				"8f9bd040d8f717b19618ab3395ddfa4b8c176b8dc863195227b88dd85426bbbc",
				SECRET,
			),
		).toBe(false);
		expect(CorvoWebhooks.verifySignature(BODY, "sha256=zzzz", SECRET)).toBe(false);
		expect(CorvoWebhooks.verifySignature(BODY, "", SECRET)).toBe(false);
		expect(CorvoWebhooks.verifySignature(BODY, SIGNATURE, "")).toBe(false);
	});
});

describe("public exports", () => {
	it("exposes the client, error, events and version", () => {
		expect(typeof Corvo).toBe("function");
		expect(typeof CorvoWebhooks.verifySignature).toBe("function");
		expect(CorvoApiError).toBeDefined();
		expect(WEBHOOK_EVENTS).toHaveLength(9);
		expect(WEBHOOK_EVENTS).toContain("nfse.invoice.fiscal_discrepancy");
		expect(WEBHOOK_EVENTS).not.toContain("webhook.test");
	});
});
