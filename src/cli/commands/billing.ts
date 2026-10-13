import type { Command } from "commander";
import { buildClient } from "../config";
import { type CliOptions, commonOptions } from "../options";
import { fail, printJson } from "../output";

export function registerBilling(program: Command): void {
	const billing = program.command("billing").description("Plan and quota usage");

	commonOptions(billing.command("plan").description("Current plan and subscription")).action(
		async function (this: Command) {
			const opts = this.opts() as CliOptions;
			const client = buildClient(opts);
			const result = await client.billing.plan();
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
		},
	);

	commonOptions(billing.command("usage").description("Quota status")).action(async function (
		this: Command,
	) {
		const opts = this.opts() as CliOptions;
		const client = buildClient(opts);
		const result = await client.billing.usage();
		if (result.error) fail(result.error, Boolean(opts.json));
		if (opts.json) return printJson(result.data);
		process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
	});
}
