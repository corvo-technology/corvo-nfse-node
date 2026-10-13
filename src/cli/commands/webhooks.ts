import type { Command } from "commander";
import type { Webhook, WebhookDelivery, WebhookEvent } from "../../types/webhook";
import { buildClient } from "../config";
import { type CliOptions, commonOptions } from "../options";
import { fail, failFatal, printJson, printPage } from "../output";
import { readPayload } from "../payload";

function toWebhookRow(webhook: Webhook): Record<string, unknown> {
	return {
		id: webhook.id,
		url: webhook.url,
		events: webhook.events.join(","),
		active: webhook.active,
		createdAt: webhook.createdAt,
	};
}

function toDeliveryRow(delivery: WebhookDelivery): Record<string, unknown> {
	return {
		id: delivery.id,
		eventType: delivery.eventType,
		status: delivery.status,
		statusCode: delivery.statusCode ?? "-",
		retryCount: delivery.retryCount,
		createdAt: delivery.createdAt,
	};
}

function parseEvents(raw: string | undefined): WebhookEvent[] {
	if (!raw) failFatal("Missing --events (comma-separated event types)");
	return raw.split(",").map((event) => event.trim()) as WebhookEvent[];
}

export function registerWebhooks(program: Command): void {
	const webhooks = program.command("webhooks").description("Manage webhooks and deliveries");

	commonOptions(webhooks.command("list").description("List webhooks"))
		.option("--limit <n>", "Page size (1-1000)")
		.option("--cursor <cursor>", "Cursor from a previous page")
		.action(async function (this: Command) {
			const opts = this.opts() as CliOptions;
			const client = buildClient(opts);
			const result = await client.webhooks.list({
				limit: opts.limit ? Number(opts.limit) : undefined,
				cursor: opts.cursor,
			});
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			printPage(result.data, toWebhookRow);
		});

	commonOptions(webhooks.command("create").description("Create a webhook"))
		.option("--url <url>", "Destination URL (or --file with {url, events})")
		.option("--events <list>", "Comma-separated event types")
		.option("--file <path>", "JSON file with {url, events} (or - for stdin)")
		.action(async function (this: Command) {
			const opts = this.opts() as CliOptions;
			const params = opts.url
				? { url: opts.url, events: parseEvents(opts.events) }
				: ((await readPayload(opts.file)) as { url: string; events: WebhookEvent[] });
			const client = buildClient(opts);
			const result = await client.webhooks.create(params);
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
			process.stdout.write("Save the secret now — it is shown only once.\n");
		});

	commonOptions(webhooks.command("remove").description("Delete a webhook"))
		.argument("<id>")
		.action(async function (this: Command, id: string) {
			const opts = this.opts() as CliOptions;
			const client = buildClient(opts);
			const result = await client.webhooks.remove(id);
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			process.stdout.write(`Webhook ${id} deleted.\n`);
		});

	commonOptions(webhooks.command("test").description("Send a webhook.test event"))
		.argument("<id>")
		.action(async function (this: Command, id: string) {
			const opts = this.opts() as CliOptions;
			const client = buildClient(opts);
			const result = await client.webhooks.test(id);
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			process.stdout.write("Test event sent.\n");
		});

	const deliveries = webhooks.command("deliveries").description("Inspect webhook deliveries");

	commonOptions(deliveries.command("list").description("List recent deliveries"))
		.option("--hours <n>", "Lookback window in hours (default 24)")
		.option("--environment <env>", "test or live")
		.option("--limit <n>", "Page size (1-1000)")
		.option("--cursor <cursor>", "Cursor from a previous page")
		.action(async function (this: Command) {
			const opts = this.opts() as CliOptions;
			if (opts.environment && opts.environment !== "test" && opts.environment !== "live") {
				failFatal("--environment must be test or live");
			}
			const client = buildClient(opts);
			const result = await client.webhooks.deliveries.list({
				hours: opts.hours ? Number(opts.hours) : undefined,
				environment: opts.environment as "test" | "live" | undefined,
				limit: opts.limit ? Number(opts.limit) : undefined,
				cursor: opts.cursor,
			});
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			printPage(result.data, toDeliveryRow);
		});

	commonOptions(deliveries.command("stats").description("Delivery counters"))
		.option("--hours <n>", "Lookback window in hours (default 24)")
		.option("--environment <env>", "test or live")
		.action(async function (this: Command) {
			const opts = this.opts() as CliOptions;
			const client = buildClient(opts);
			const result = await client.webhooks.deliveries.stats({
				hours: opts.hours ? Number(opts.hours) : undefined,
				environment: opts.environment as "test" | "live" | undefined,
			});
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
		});

	commonOptions(deliveries.command("retry").description("Retry a delivery now"))
		.argument("<id>")
		.action(async function (this: Command, id: string) {
			const opts = this.opts() as CliOptions;
			const client = buildClient(opts);
			const result = await client.webhooks.deliveries.retry(id);
			if (result.error) fail(result.error, Boolean(opts.json));
			if (opts.json) return printJson(result.data);
			process.stdout.write(`Delivery ${id} requeued.\n`);
		});
}
