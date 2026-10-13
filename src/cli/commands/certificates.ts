import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { Command } from "commander";
import type { Certificate } from "../../types/certificate";
import { buildClient } from "../config";
import { type CliOptions, commonOptions } from "../options";
import { fail, failFatal, printJson, printPage } from "../output";

function toRow(cert: Certificate): Record<string, unknown> {
	return {
		id: cert.id,
		status: cert.status,
		fingerprint: cert.fingerprint,
		validFrom: cert.validFrom,
		validUntil: cert.validUntil,
	};
}

export function registerCertificates(program: Command): void {
	const certificates = program.command("certificates").description("Manage A1 certificates");

	commonOptions(certificates.command("list").description("List certificates of a company"))
		.argument("<companyId>")
		.option("--limit <n>", "Page size (1-1000)")
		.option("--cursor <cursor>", "Cursor from a previous page")
		.action(async function (this: Command, companyId: string) {
			const opts = this.opts() as CliOptions;
			const client = buildClient(opts);
			const result = await client.certificates.list(companyId, {
				limit: opts.limit ? Number(opts.limit) : undefined,
				cursor: opts.cursor,
			});
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			printPage(result.data, toRow);
		});

	commonOptions(certificates.command("upload").description("Upload a .p12 certificate"))
		.argument("<companyId>")
		.requiredOption("--file <path>", "Path to the .p12 file")
		.option("--password <password>", "Certificate password (or CORVO_CERT_PASSWORD)")
		.action(async function (this: Command, companyId: string) {
			const opts = this.opts() as CliOptions & { file: string };
			await upload(companyId, opts);
		});

	commonOptions(certificates.command("remove").description("Delete a certificate"))
		.argument("<companyId>")
		.argument("<certId>")
		.action(async function (this: Command, companyId: string, certId: string) {
			const opts = this.opts() as CliOptions;
			const client = buildClient(opts);
			const result = await client.certificates.remove(companyId, certId);
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			process.stdout.write(`Certificate ${certId} deleted.\n`);
		});
}

async function upload(companyId: string, opts: CliOptions & { file: string }): Promise<void> {
	const password = opts.password ?? process.env.CORVO_CERT_PASSWORD;
	if (!password) failFatal("Provide --password or set CORVO_CERT_PASSWORD");
	const path = resolve(opts.file);
	const file = readFileSync(path);
	if (file.length > 50 * 1024) failFatal("Certificate file exceeds 50 KiB");
	const client = buildClient(opts);
	const result = await client.certificates.upload(companyId, {
		file,
		fileName: basename(path),
		password,
	});
	if (result.error) fail(result.error, Boolean(opts.json));
	if (opts.json) return printJson(result.data);
	process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
}
