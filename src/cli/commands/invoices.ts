import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";
import type { Invoice, InvoiceListParams, InvoiceStatus } from "../../types/invoice";
import { buildClient } from "../config";
import { type CliOptions, commonOptions } from "../options";
import { fail, failFatal, printJson, printPage } from "../output";
import { readPayload } from "../payload";

function toRow(invoice: Invoice): Record<string, unknown> {
	return {
		id: invoice.id,
		status: invoice.status,
		stage: invoice.stage,
		nfseNumber: invoice.nfseNumber ?? "-",
		amount: invoice.amount,
		customer: invoice.customerSnapshot.name,
		createdAt: invoice.createdAt,
	};
}

export function registerInvoices(program: Command): void {
	const invoices = program.command("invoices").description("Issue and inspect NFS-e invoices");

	commonOptions(invoices.command("list").description("List invoices"))
		.option("--company-id <id>", "Filter by company")
		.option("--status <status>", "Filter by status")
		.option("--from <date>", "Competence start date (ISO)")
		.option("--to <date>", "Competence end date (ISO)")
		.option("--external-id <id>", "Filter by externalId")
		.option("--limit <n>", "Page size (1-1000)")
		.option("--cursor <cursor>", "Cursor from a previous page")
		.action(async function (this: Command) {
			const opts = this.opts() as CliOptions;
			const client = buildClient(opts);
			const params: InvoiceListParams = {
				companyId: opts.companyId,
				status: opts.status as InvoiceStatus | undefined,
				from: opts.from,
				to: opts.to,
				externalId: opts.externalId,
				limit: opts.limit ? Number(opts.limit) : undefined,
				cursor: opts.cursor,
			};
			const result = await client.invoices.list(params);
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			printPage(result.data, toRow);
		});

	commonOptions(invoices.command("get").description("Get an invoice by id"))
		.argument("<id>")
		.action(async function (this: Command, id: string) {
			const opts = this.opts() as CliOptions;
			const client = buildClient(opts);
			const result = await client.invoices.get(id);
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
		});

	commonOptions(invoices.command("create").description("Issue an invoice from a JSON payload"))
		.option("--file <path>", "JSON file with the invoice payload (- for stdin)")
		.option("--idempotency-key <key>", "Idempotency-Key header value")
		.option("--email", "Also email the customer (options.email.send)")
		.action(async function (this: Command) {
			const opts = this.opts() as CliOptions;
			const payload = await readPayload(opts.file);
			if (opts.email) {
				const options = (payload.options as Record<string, unknown> | undefined) ?? {};
				payload.options = { ...options, email: { send: true } };
			}
			const client = buildClient(opts);
			const result = await client.invoices.create(payload as never, {
				idempotencyKey: opts.idempotencyKey,
			});
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
		});

	commonOptions(invoices.command("events").description("List invoice lifecycle events"))
		.argument("<id>")
		.option("--limit <n>", "Page size (1-1000)")
		.option("--cursor <cursor>", "Cursor from a previous page")
		.action(async function (this: Command, id: string) {
			const opts = this.opts() as CliOptions;
			const client = buildClient(opts);
			const result = await client.invoices.events(id, {
				limit: opts.limit ? Number(opts.limit) : undefined,
				cursor: opts.cursor,
			});
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			printPage(result.data, (event) => ({
				toStatus: event.toStatus,
				fromStatus: event.fromStatus ?? "-",
				reason: event.reason ?? "-",
				createdAt: event.createdAt,
			}));
		});

	for (const format of ["pdf", "xml"] as const) {
		commonOptions(
			invoices.command(format).description(`Download the invoice ${format.toUpperCase()}`),
		)
			.argument("<id>")
			.option("-o, --output <path>", `Target file (default nfse-<id>.${format})`)
			.action(async function (this: Command, id: string) {
				const opts = this.opts() as CliOptions;
				const client = buildClient(opts);
				const result =
					format === "pdf" ? await client.invoices.pdf(id) : await client.invoices.xml(id);
				if (result.error) fail(result.error, Boolean(opts.json));
				const target = resolve(opts.output ?? `nfse-${id}.${format}`);
				writeFileSync(target, result.data.buffer);
				process.stdout.write(`Saved ${target} (${result.data.buffer.length} bytes)\n`);
			});
	}

	commonOptions(invoices.command("download-url").description("Get a signed download URL"))
		.argument("<id>")
		.option("--format <format>", "pdf or xml", "pdf")
		.action(async function (this: Command, id: string) {
			const opts = this.opts() as CliOptions;
			if (opts.format !== "pdf" && opts.format !== "xml") failFatal("--format must be pdf or xml");
			const client = buildClient(opts);
			const result = await client.invoices.downloadUrl(id, opts.format);
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
		});

	commonOptions(invoices.command("email").description("Send the invoice to the customer"))
		.argument("<id>")
		.option("--idempotency-key <key>", "Idempotency-Key header value")
		.action(async function (this: Command, id: string) {
			const opts = this.opts() as CliOptions;
			const client = buildClient(opts);
			const result = await client.invoices.sendEmail(id, { idempotencyKey: opts.idempotencyKey });
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
		});
}
