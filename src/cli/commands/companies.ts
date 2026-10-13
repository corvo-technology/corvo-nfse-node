import type { Command } from "commander";
import type { Company } from "../../types/company";
import { buildClient } from "../config";
import { type CliOptions, commonOptions } from "../options";
import { fail, printJson, printPage } from "../output";
import { readPayload } from "../payload";

function toRow(company: Company): Record<string, unknown> {
	return {
		id: company.id,
		legalName: company.legalName,
		taxId: company.taxId,
		status: company.status,
		environment: company.environment,
	};
}

export function registerCompanies(program: Command): void {
	const companies = program.command("companies").description("Manage companies");

	commonOptions(companies.command("list").description("List companies"))
		.option("--limit <n>", "Page size (1-1000)")
		.option("--cursor <cursor>", "Cursor from a previous page")
		.action(async function (this: Command) {
			const opts = this.opts() as CliOptions;
			const client = buildClient(opts);
			const result = await client.companies.list({
				limit: opts.limit ? Number(opts.limit) : undefined,
				cursor: opts.cursor,
			});
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			printPage(result.data, toRow);
		});

	commonOptions(companies.command("get").description("Get a company by id"))
		.argument("<id>")
		.action(async function (this: Command, id: string) {
			const opts = this.opts() as CliOptions;
			const client = buildClient(opts);
			const result = await client.companies.get(id);
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
		});

	commonOptions(companies.command("create").description("Create a company"))
		.option("--file <path>", "JSON file with the company payload (or - for stdin)")
		.action(async function (this: Command) {
			const opts = this.opts() as CliOptions;
			const payload = await readPayload(opts.file);
			const client = buildClient(opts);
			const result = await client.companies.create(payload as never);
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
		});

	commonOptions(companies.command("update").description("Update a company"))
		.argument("<id>")
		.option("--file <path>", "JSON file with the patch (or - for stdin)")
		.action(async function (this: Command, id: string) {
			const opts = this.opts() as CliOptions;
			const payload = await readPayload(opts.file);
			const client = buildClient(opts);
			const result = await client.companies.update(id, payload);
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
		});

	commonOptions(companies.command("remove").description("Delete a company"))
		.argument("<id>")
		.action(async function (this: Command, id: string) {
			const opts = this.opts() as CliOptions;
			const client = buildClient(opts);
			const result = await client.companies.remove(id);
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			process.stdout.write(`Company ${id} deleted.\n`);
		});
}
