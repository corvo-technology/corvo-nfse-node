import type { Command } from "commander";
import { buildClient } from "../config";
import { type CliOptions, commonOptions } from "../options";
import { printResult } from "../output";

export function registerCnpj(program: Command): void {
	commonOptions(program.command("cnpj").description("Look up the registration data of a CNPJ"))
		.argument("<cnpj>", "CNPJ, digits only")
		.action(async function (this: Command, cnpj: string) {
			const opts = this.opts() as CliOptions;
			printResult(await buildClient(opts).cnpj.lookup(cnpj), Boolean(opts.json));
		});
}
