import { describe, expect, it, vi } from "vitest";
import { fail, formatError, formatTable } from "../../src/cli/output";
import { CorvoApiError } from "../../src/error";

describe("cli output", () => {
	it("formatTable renders aligned columns", () => {
		const table = formatTable([
			{ id: "co_1", name: "ACME" },
			{ id: "co_2", name: "Beta" },
		]);
		const lines = table.split("\n");
		expect(lines[0]).toBe("id    name");
		expect(lines[1]).toBe("----  ----");
		expect(lines[2]).toBe("co_1  ACME");
		expect(lines[3]).toBe("co_2  Beta");
	});

	it("formatError renders code, requestId and details", () => {
		const error = new CorvoApiError({
			message: "Request validation failed",
			status: 400,
			code: "ERROR_VALIDATION",
			details: [{ field: "service.code", code: "ERROR_INVALID", message: "must be 6 digits" }],
			requestId: "req-1",
			retryAfter: 12,
		});
		const text = formatError(error);
		expect(text).toContain("ERROR_VALIDATION: Request validation failed (HTTP 400)");
		expect(text).toContain("requestId: req-1");
		expect(text).toContain("service.code");
		expect(text).toContain("retryAfter: 12s");
	});

	it("fail writes to stderr and exits 1", () => {
		const stderr: string[] = [];
		const write = vi.spyOn(process.stderr, "write").mockImplementation(((
			chunk: string | Uint8Array,
		) => {
			stderr.push(String(chunk));
			return true;
		}) as typeof process.stderr.write);
		const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
			throw new Error(`exit:${code}`);
		}) as never);
		const error = new CorvoApiError({
			message: "boom",
			status: 500,
			code: "ERROR_INTERNAL",
			requestId: "r1",
		});
		expect(() => fail(error, false)).toThrow("exit:1");
		expect(stderr.join("")).toContain("ERROR_INTERNAL");
		expect(stderr.join("")).toContain("r1");
		write.mockRestore();
		exit.mockRestore();
	});
});
