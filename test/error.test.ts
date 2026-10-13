import { describe, expect, it } from "vitest";
import { CorvoApiError, type Result } from "../src/error";

describe("CorvoApiError", () => {
	it("exposes the contract error fields", () => {
		const error = new CorvoApiError({
			message: "Request validation failed",
			status: 400,
			code: "ERROR_VALIDATION",
			details: [
				{ field: "customer.taxId", code: "ERROR_INVALID_TAX_ID", message: "Invalid tax ID" },
			],
			requestId: "9f1fc995-4ee4-4a92-b285-cf8dff227a97",
			retryAfter: 30,
		});
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("CorvoApiError");
		expect(error.status).toBe(400);
		expect(error.code).toBe("ERROR_VALIDATION");
		expect(error.details).toHaveLength(1);
		expect(error.requestId).toBe("9f1fc995-4ee4-4a92-b285-cf8dff227a97");
		expect(error.retryAfter).toBe(30);
		expect(error.stack).toBeTruthy();
	});

	it("Result types both sides", () => {
		const ok: Result<number> = { data: 1 };
		const err: Result<number> = {
			error: new CorvoApiError({ message: "x", status: 0, code: "timeout" }),
		};
		expect(ok.data).toBe(1);
		expect(err.error?.code).toBe("timeout");
	});
});
