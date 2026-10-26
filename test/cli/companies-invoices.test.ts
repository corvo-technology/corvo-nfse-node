import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

const company = {
	id: "09947127-2702-4f6d-9da8-cb463608d812",
	legalName: "Empresa Exemplo Tecnologia LTDA",
	taxId: "41834687000148",
	status: "ready",
	environment: "test",
};

describe("cli companies", () => {
	it("lists companies as a table by default", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse({
					data: [company],
					pagination: { limit: 50, hasMore: false, nextCursor: null },
				}),
			),
		);
		await run("companies", "list");
		const text = stdout.join("");
		expect(text).toContain("legalName");
		expect(text).toContain("Empresa Exemplo Tecnologia LTDA");
	});

	it("prints the raw page as JSON with --json", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse({
					data: [company],
					pagination: { limit: 50, hasMore: false, nextCursor: null },
				}),
			),
		);
		await run("companies", "list", "--json");
		const parsed = JSON.parse(stdout.join(""));
		expect(parsed.data[0].id).toBe(company.id);
		expect(parsed.pagination.hasMore).toBe(false);
	});

	it("shows API errors on stderr and exits 1", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse(
					{
						statusCode: 403,
						code: "ERROR_FORBIDDEN",
						message: "no permission",
						requestId: "req-9",
					},
					{ status: 403 },
				),
			),
		);
		await expect(run("companies", "list")).rejects.toThrow("exit:1");
		const text = stderr.join("");
		expect(text).toContain("ERROR_FORBIDDEN");
		expect(text).toContain("req-9");
	});

	it("gets a company by id", async () => {
		const urls: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string) => {
				urls.push(url);
				return jsonResponse({ data: company });
			}),
		);
		await run("companies", "get", company.id);
		expect(urls[0]).toContain(`/v1/companies/${company.id}`);
		expect(stdout.join("")).toContain(company.legalName);
	});
});

describe("cli invoices", () => {
	it("creates an invoice from a JSON file with --email and --idempotency-key", async () => {
		const dir = mkdtempSync(join(tmpdir(), "corvo-invoice-"));
		const file = join(dir, "nota.json");
		const payload = {
			companyId: "09947127-2702-4f6d-9da8-cb463608d812",
			customer: { name: "Cliente", taxId: "52998224725" },
			service: { code: "010101", municipalityCode: "3170206" },
			amount: 10.5,
			competenceDate: "2026-10-12",
		};
		writeFileSync(file, JSON.stringify(payload));

		let sentBody: Record<string, unknown> = {};
		let idempotency: string | undefined;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string, init?: RequestInit) => {
				sentBody = JSON.parse(String(init?.body));
				idempotency = (init?.headers as Record<string, string>)["Idempotency-Key"];
				return jsonResponse({ data: { id: "inv_1", status: "queued" } }, { status: 202 });
			}),
		);
		await run("invoices", "create", "--file", file, "--email", "--idempotency-key", "order-1");
		expect((sentBody.options as { email: { send: boolean } }).email.send).toBe(true);
		expect(idempotency).toBe("order-1");
		expect(stdout.join("")).toContain("inv_1");
		rmSync(dir, { recursive: true, force: true });
	});

	it("fails fast on an invalid JSON file", async () => {
		const dir = mkdtempSync(join(tmpdir(), "corvo-invoice-"));
		const file = join(dir, "broken.json");
		writeFileSync(file, "{ nope");
		await expect(run("invoices", "create", "--file", file)).rejects.toThrow("exit:1");
		expect(stderr.join("")).toContain("Error:");
		rmSync(dir, { recursive: true, force: true });
	});

	it("downloads a PDF to the requested file", async () => {
		const dir = mkdtempSync(join(tmpdir(), "corvo-pdf-"));
		const target = join(dir, "saida.pdf");
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response("%PDF-1.7 conteudo", {
						status: 200,
						headers: {
							"content-type": "application/pdf",
							"content-disposition": 'attachment; filename="nfse-1001.pdf"',
						},
					}),
			),
		);
		await run("invoices", "pdf", "inv_1", "--output", target);
		expect(existsSync(target)).toBe(true);
		expect(readFileSync(target, "utf8")).toBe("%PDF-1.7 conteudo");
		expect(stdout.join("")).toContain("Saved");
		rmSync(dir, { recursive: true, force: true });
	});

	it("lists invoices with filters", async () => {
		const urls: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string) => {
				urls.push(url);
				return jsonResponse({
					data: [
						{
							id: "inv_1",
							status: "authorized",
							stage: "completed",
							nfseNumber: 1001,
							amount: 10.5,
							customerSnapshot: { name: "Cliente" },
							createdAt: "2026-10-12T13:04:38.985Z",
						},
					],
					pagination: { limit: 50, hasMore: false, nextCursor: null },
				});
			}),
		);
		await run("invoices", "list", "--company-id", "co_1", "--status", "authorized", "--json");
		expect(urls[0]).toContain("companyId=co_1");
		expect(urls[0]).toContain("status=authorized");
		const parsed = JSON.parse(stdout.join(""));
		expect(parsed.data[0].nfseNumber).toBe(1001);
	});
	it("cancels an invoice with --reason and --description", async () => {
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string, init?: RequestInit) => {
				calls.push({ url, init });
				return jsonResponse(
					{ data: { id: "inv_1", status: "cancelling", cancellationReason: "issue_error" } },
					{ status: 202 },
				);
			}),
		);
		await run(
			"invoices",
			"cancel",
			"inv_1",
			"--reason",
			"issue_error",
			"--description",
			"Wrong amount on the invoice",
		);
		expect(calls[0].url).toContain("/v1/invoices/inv_1/cancel");
		expect(calls[0].init?.method).toBe("POST");
		expect(JSON.parse(String(calls[0].init?.body))).toEqual({
			reason: "issue_error",
			description: "Wrong amount on the invoice",
		});
		expect(stdout.join("")).toContain("cancelling");
	});

	it("cancels with --json and omits an absent description", async () => {
		let body: Record<string, unknown> = {};
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string, init?: RequestInit) => {
				body = JSON.parse(String(init?.body));
				return jsonResponse({ data: { id: "inv_1", status: "cancelled" } });
			}),
		);
		await run("invoices", "cancel", "inv_1", "--reason", "other", "--json");
		expect(body).toEqual({ reason: "other" });
		expect(JSON.parse(stdout.join("")).status).toBe("cancelled");
	});

	it("rejects an unknown --reason without calling the API", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		await expect(run("invoices", "cancel", "inv_1", "--reason", "nope")).rejects.toThrow("exit:1");
		expect(fetchMock).not.toHaveBeenCalled();
		expect(stderr.join("")).toContain("--reason");
	});

	it("shows ERROR_INVOICE_NOT_CANCELLABLE on stderr and exits 1", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse(
					{ statusCode: 409, code: "ERROR_INVOICE_NOT_CANCELLABLE", message: "not cancellable" },
					{ status: 409 },
				),
			),
		);
		await expect(run("invoices", "cancel", "inv_1", "--reason", "issue_error")).rejects.toThrow(
			"exit:1",
		);
		expect(stderr.join("")).toContain("ERROR_INVOICE_NOT_CANCELLABLE");
	});
});
