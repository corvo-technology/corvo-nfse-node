import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";
import { buildClient } from "../config";
import { type CliOptions, commonOptions } from "../options";
import { fail, failFatal, printResult } from "../output";

export function registerAccountantPackage(program: Command): void {
	const pkg = program
		.command("package")
		.description("Monthly package for the accountant (ZIP with XML, PDF and summary)");

	commonOptions(pkg.command("summary").description("Count and total of a month, without building"))
		.argument("<companyId>")
		.requiredOption("--month <YYYY-MM>", "Competence month")
		.action(async function (this: Command, companyId: string) {
			const opts = this.opts() as CliOptions;
			printResult(
				await buildClient(opts).companies.invoicePackage.summary(companyId, opts.month as string),
				Boolean(opts.json),
			);
		});

	commonOptions(pkg.command("download").description("Download the month package (ZIP)"))
		.argument("<companyId>")
		.requiredOption("--month <YYYY-MM>", "Competence month")
		.option("--include <parts>", "xml, pdf or xml,pdf (default both)")
		.option("-o, --output <path>", "Target file (default pacote-<month>.zip)")
		.action(async function (this: Command, companyId: string) {
			const opts = this.opts() as CliOptions;
			const include = opts.include?.split(",").map((part) => part.trim());
			if (include?.some((part) => part !== "xml" && part !== "pdf"))
				failFatal("--include accepts xml and pdf");
			const result = await buildClient(opts).companies.invoicePackage.download(companyId, {
				month: opts.month as string,
				include: include as Array<"xml" | "pdf"> | undefined,
			});
			if (result.error) fail(result.error, Boolean(opts.json));
			const target = resolve(opts.output ?? `pacote-${opts.month}.zip`);
			writeFileSync(target, result.data.buffer);
			process.stdout.write(`Saved ${target} (${result.data.buffer.length} bytes)\n`);
		});

	commonOptions(pkg.command("accountant").description("Show the accountant e-mail"))
		.argument("<companyId>")
		.action(async function (this: Command, companyId: string) {
			const opts = this.opts() as CliOptions;
			printResult(
				await buildClient(opts).companies.accountantPackage.get(companyId),
				Boolean(opts.json),
			);
		});

	commonOptions(
		pkg.command("set-accountant").description("Set the accountant e-mail (use --off to turn off)"),
	)
		.argument("<companyId>")
		.option("--to <email>", "Accountant e-mail")
		.option("--off", "Turn the monthly send off")
		.action(async function (this: Command, companyId: string) {
			const opts = this.opts() as CliOptions & { off?: boolean };
			if (!opts.to && !opts.off) failFatal("Pass --to <email> or --off");
			printResult(
				await buildClient(opts).companies.accountantPackage.update(companyId, {
					accountantEmail: opts.off ? null : opts.to,
				}),
				Boolean(opts.json),
			);
		});

	commonOptions(pkg.command("send").description("Send a month to the accountant now"))
		.argument("<companyId>")
		.requiredOption("--month <YYYY-MM>", "Competence month")
		.action(async function (this: Command, companyId: string) {
			const opts = this.opts() as CliOptions;
			printResult(
				await buildClient(opts).companies.accountantPackage.send(companyId, {
					month: opts.month as string,
				}),
				Boolean(opts.json),
			);
		});

	commonOptions(pkg.command("sends").description("Last attempts to send to the accountant"))
		.argument("<companyId>")
		.action(async function (this: Command, companyId: string) {
			const opts = this.opts() as CliOptions;
			printResult(
				await buildClient(opts).companies.accountantPackage.listSends(companyId),
				Boolean(opts.json),
			);
		});
}
