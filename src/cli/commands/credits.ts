import type { Command } from "commander";
import type { CreditTransaction } from "../../types/credits";
import { buildClient } from "../config";
import { type CliOptions, commonOptions } from "../options";
import { fail, printJson, printPage } from "../output";

export function registerCredits(program: Command): void {
	const credits = program.command("credits").description("Inspect credit balance and history");

	commonOptions(credits.command("balance").description("Current credit balance")).action(
		async function (this: Command) {
			const opts = this.opts() as CliOptions;
			const client = buildClient(opts);
			const result = await client.credits.balance();
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
		},
	);

	commonOptions(credits.command("plans").description("Available credit plans"))
		.option("--limit <n>", "Page size (1-1000)")
		.option("--cursor <cursor>", "Cursor from a previous page")
		.action(async function (this: Command) {
			const opts = this.opts() as CliOptions;
			const client = buildClient(opts);
			const result = await client.credits.plans({
				limit: opts.limit ? Number(opts.limit) : undefined,
				cursor: opts.cursor,
			});
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			printPage(result.data, (plan) => ({
				slug: plan.slug,
				name: plan.name,
				dailyLimit: plan.dailyLimit,
				maxActiveCompanies: plan.maxActiveCompanies,
				creditUnitPriceCents: plan.creditUnitPriceCents,
				active: plan.active,
			}));
		});

	commonOptions(credits.command("history").description("Credit movement history"))
		.option("--limit <n>", "Page size (1-1000)")
		.option("--cursor <cursor>", "Cursor from a previous page")
		.action(async function (this: Command) {
			const opts = this.opts() as CliOptions;
			const client = buildClient(opts);
			const result = await client.credits.history({
				limit: opts.limit ? Number(opts.limit) : undefined,
				cursor: opts.cursor,
			});
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			const toRow = (entry: CreditTransaction): Record<string, unknown> => ({
				createdAt: entry.createdAt,
				type: entry.type,
				source: entry.source,
				amount: entry.amount,
				description: entry.description ?? "-",
			});
			printPage(result.data, toRow);
		});
}
