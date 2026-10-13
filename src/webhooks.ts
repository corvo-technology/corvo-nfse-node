import { createHmac, timingSafeEqual } from "node:crypto";

export class CorvoWebhooks {
	private constructor() {}

	static verifySignature(
		rawBody: string | Buffer,
		signatureHeader: string | null | undefined,
		secret: string,
	): boolean {
		if (typeof signatureHeader !== "string" || typeof secret !== "string" || secret.length === 0) {
			return false;
		}
		const match = /^sha256=([0-9a-f]{64})$/.exec(signatureHeader.trim());
		if (!match) return false;
		const received = Buffer.from(match[1], "hex");
		const expected = createHmac("sha256", secret).update(rawBody).digest();
		if (received.length !== expected.length) return false;
		return timingSafeEqual(received, expected);
	}
}
