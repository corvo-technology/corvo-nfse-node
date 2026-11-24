import type { Command } from "commander";
import type { Schedule, ScheduleStatus } from "../../types/schedule";
import { buildClient } from "../config";
import { type CliOptions, commonOptions } from "../options";
import { fail, printJson, printPage, printResult } from "../output";
import { readPayload } from "../payload";

function toRow(schedule: Schedule): Record<string, unknown> {
	return {
		id: schedule.id,
		kind: schedule.kind,
		status: schedule.status,
		frequency: schedule.frequency ?? "-",
		nextRunOn: schedule.next_run_on ?? "-",
		endsOn: schedule.ends_on ?? "-",
	};
}

export function registerSchedules(program: Command): void {
	const schedules = program.command("schedules").description("Scheduled and recurring invoices");

	commonOptions(schedules.command("list").description("List schedules"))
		.option("--status <status>", "active, paused, completed or cancelled")
		.option("--company-id <id>", "Filter by company")
		.option("--limit <n>", "Page size (1-1000)")
		.option("--cursor <cursor>", "Cursor from a previous page")
		.action(async function (this: Command) {
			const opts = this.opts() as CliOptions;
			const result = await buildClient(opts).schedules.list({
				status: opts.status as ScheduleStatus | undefined,
				companyId: opts.companyId,
				limit: opts.limit ? Number(opts.limit) : undefined,
				cursor: opts.cursor,
			});
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			printPage(result.data, toRow);
		});

	commonOptions(schedules.command("get").description("Get a schedule"))
		.argument("<id>")
		.action(async function (this: Command, id: string) {
			const opts = this.opts() as CliOptions;
			printResult(await buildClient(opts).schedules.get(id), Boolean(opts.json));
		});

	commonOptions(schedules.command("update").description("Change a schedule (next runs only)"))
		.argument("<id>")
		.option("--file <path>", "JSON file: { anchorOn?, endsOn?, frequency?, invoice? }")
		.action(async function (this: Command, id: string) {
			const opts = this.opts() as CliOptions;
			const payload = await readPayload(opts.file);
			printResult(await buildClient(opts).schedules.update(id, payload), Boolean(opts.json));
		});

	for (const action of ["pause", "resume", "cancel"] as const) {
		commonOptions(schedules.command(action).description(`${action} a schedule`))
			.argument("<id>")
			.action(async function (this: Command, id: string) {
				const opts = this.opts() as CliOptions;
				printResult(await buildClient(opts).schedules[action](id), Boolean(opts.json));
			});
	}

	commonOptions(schedules.command("runs").description("Log of every attempt to run a schedule"))
		.argument("<id>")
		.option("--limit <n>", "Page size (1-1000)")
		.option("--cursor <cursor>", "Cursor from a previous page")
		.action(async function (this: Command, id: string) {
			const opts = this.opts() as CliOptions;
			const result = await buildClient(opts).schedules.listRuns(id, {
				limit: opts.limit ? Number(opts.limit) : undefined,
				cursor: opts.cursor,
			});
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			printPage(result.data, (run) => ({
				ranOn: run.ran_on,
				occurrenceOn: run.occurrence_on,
				outcome: run.outcome,
				invoiceId: run.invoice_id ?? "-",
				error: run.error_code ?? "-",
			}));
		});
}
