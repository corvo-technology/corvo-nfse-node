import type { Command } from "commander";
import { buildClient } from "../config";
import { type CliOptions, commonOptions } from "../options";
import { fail, printJson } from "../output";

export function registerHealth(program: Command): void {
	const health = program.command("health").description("Instance health");

	commonOptions(health.command("live").description("Liveness probe")).action(async function (
		this: Command,
	) {
		const opts = this.opts() as CliOptions;
		const client = buildClient(opts);
		const result = await client.health.live();
		if (result.error) fail(result.error, Boolean(opts.json));
		if (opts.json) return printJson(result.data);
		process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
	});

	commonOptions(health.command("ready").description("Readiness probe")).action(async function (
		this: Command,
	) {
		const opts = this.opts() as CliOptions;
		const client = buildClient(opts);
		const result = await client.health.ready();
		if (result.error) fail(result.error, Boolean(opts.json));
		if (opts.json) return printJson(result.data);
		process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
	});
}
