import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { Command } from "commander";
import type { ImportRow } from "../../types/import";
import { buildClient } from "../config";
import { type CliOptions, commonOptions } from "../options";
import { fail, printJson, printPage, printResult } from "../output";

export function registerImports(program: Command): void {
	const imports = program.command("imports").description("Import invoices from a spreadsheet");

	commonOptions(imports.command("start").description("Upload a .csv or .xlsx file"))
		.argument("<file>", "Path of the spreadsheet")
		.option("--company-id <id>", "Company that issues the rows without a CNPJ")
		.action(async function (this: Command, file: string) {
			const opts = this.opts() as CliOptions;
			const result = await buildClient(opts).imports.start({
				file: readFileSync(resolve(file)),
				fileName: basename(file),
				companyId: opts.companyId,
			});
			printResult(result, Boolean(opts.json));
		});

	commonOptions(imports.command("list").description("Recent imports"))
		.option("--limit <n>", "How many (1-20)")
		.action(async function (this: Command) {
			const opts = this.opts() as CliOptions;
			printResult(
				await buildClient(opts).imports.list({
					limit: opts.limit ? Number(opts.limit) : undefined,
				}),
				Boolean(opts.json),
			);
		});

	commonOptions(imports.command("get").description("Status and counters of an import"))
		.argument("<id>")
		.action(async function (this: Command, id: string) {
			const opts = this.opts() as CliOptions;
			printResult(await buildClient(opts).imports.get(id), Boolean(opts.json));
		});

	commonOptions(imports.command("emit").description("Emit every valid row"))
		.argument("<id>")
		.option("--send-email", "E-mail each issued invoice to its customer")
		.action(async function (this: Command, id: string) {
			const opts = this.opts() as CliOptions;
			printResult(
				await buildClient(opts).imports.emit(id, { sendEmail: opts.sendEmail ? true : undefined }),
				Boolean(opts.json),
			);
		});

	commonOptions(imports.command("rows").description("Rows of an import"))
		.argument("<id>")
		.option("--status <status>", "valid, invalid, queued, accepted or rejected")
		.option("--limit <n>", "Page size (1-200)")
		.option("--cursor <cursor>", "Cursor from a previous page")
		.action(async function (this: Command, id: string) {
			const opts = this.opts() as CliOptions;
			const result = await buildClient(opts).imports.listRows(id, {
				status: opts.status as ImportRow["status"] | undefined,
				limit: opts.limit ? Number(opts.limit) : undefined,
				cursor: opts.cursor,
			});
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			printPage(result.data, (row) => ({
				line: row.line,
				status: row.status,
				invoiceId: row.invoice_id ?? "-",
				error: row.error_code ?? "-",
			}));
		});

	commonOptions(imports.command("discard").description("Discard an import not yet emitted"))
		.argument("<id>")
		.action(async function (this: Command, id: string) {
			const opts = this.opts() as CliOptions;
			const result = await buildClient(opts).imports.discard(id);
			if (result.error) fail(result.error, Boolean(opts.json));
			process.stdout.write(`Import ${id} discarded.\n`);
		});

	commonOptions(imports.command("template").description("Download the spreadsheet template"))
		.option("-o, --output <path>", "Target file", "modelo-importacao.csv")
		.action(async function (this: Command) {
			const opts = this.opts() as CliOptions;
			const result = await buildClient(opts).imports.downloadTemplate();
			if (result.error) fail(result.error, Boolean(opts.json));
			const target = resolve(opts.output ?? "modelo-importacao.csv");
			writeFileSync(target, result.data.buffer);
			process.stdout.write(`Saved ${target} (${result.data.buffer.length} bytes)\n`);
		});

	commonOptions(imports.command("errors").description("Download the CSV of rows with errors"))
		.argument("<id>")
		.option("-o, --output <path>", "Target file (default erros-<id>.csv)")
		.action(async function (this: Command, id: string) {
			const opts = this.opts() as CliOptions;
			const result = await buildClient(opts).imports.downloadErrors(id);
			if (result.error) fail(result.error, Boolean(opts.json));
			const target = resolve(opts.output ?? `erros-${id}.csv`);
			writeFileSync(target, result.data.buffer);
			process.stdout.write(`Saved ${target} (${result.data.buffer.length} bytes)\n`);
		});
}
