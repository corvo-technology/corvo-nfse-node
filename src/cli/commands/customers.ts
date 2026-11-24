import type { Command } from "commander";
import type { Customer } from "../../types/customer";
import { buildClient } from "../config";
import { type CliOptions, commonOptions } from "../options";
import { fail, printJson, printPage, printResult } from "../output";
import { readPayload } from "../payload";

function toRow(customer: Customer): Record<string, unknown> {
	return {
		taxId: customer.taxId,
		name: customer.name,
		email: customer.email ?? "-",
		lastUsedAt: customer.lastUsedAt,
	};
}

export function registerCustomers(program: Command): void {
	const customers = program.command("customers").description("Saved customers");

	commonOptions(customers.command("search").description("List saved customers"))
		.option("--search <text>", "Part of the name, or the first digits of the CPF/CNPJ")
		.option("--limit <n>", "Page size (1-1000)")
		.option("--cursor <cursor>", "Cursor from a previous page")
		.action(async function (this: Command) {
			const opts = this.opts() as CliOptions;
			const result = await buildClient(opts).customers.search({
				search: opts.search,
				limit: opts.limit ? Number(opts.limit) : undefined,
				cursor: opts.cursor,
			});
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			printPage(result.data, toRow);
		});

	commonOptions(customers.command("get").description("Get a saved customer by CPF/CNPJ"))
		.argument("<taxId>")
		.action(async function (this: Command, taxId: string) {
			const opts = this.opts() as CliOptions;
			printResult(await buildClient(opts).customers.get(taxId), Boolean(opts.json));
		});

	commonOptions(customers.command("update").description("Correct the name or e-mail"))
		.argument("<taxId>")
		.option("--file <path>", "JSON file: { name?, email? } (- for stdin)")
		.action(async function (this: Command, taxId: string) {
			const opts = this.opts() as CliOptions;
			const payload = await readPayload(opts.file);
			printResult(await buildClient(opts).customers.update(taxId, payload), Boolean(opts.json));
		});

	commonOptions(customers.command("remove").description("Forget a saved customer"))
		.argument("<taxId>")
		.action(async function (this: Command, taxId: string) {
			const opts = this.opts() as CliOptions;
			const result = await buildClient(opts).customers.remove(taxId);
			if (result.error) fail(result.error, Boolean(opts.json));
			process.stdout.write(`Customer ${taxId} removed.\n`);
		});
}
