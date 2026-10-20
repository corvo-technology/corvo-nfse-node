import type { Command } from "commander";

export interface CliOptions {
	json?: boolean;
	apiKey?: string;
	baseUrl?: string;
	limit?: string;
	cursor?: string;
	companyId?: string;
	status?: string;
	from?: string;
	to?: string;
	externalId?: string;
	file?: string;
	output?: string;
	format?: string;
	email?: boolean;
	idempotencyKey?: string;
	password?: string;
	hours?: string;
	environment?: string;
	url?: string;
	events?: string;
	reason?: string;
	description?: string;
}

export function commonOptions(command: Command): Command {
	return command
		.option("--json", "Raw JSON output")
		.option("--api-key <key>", "API key (overrides env and config file)")
		.option("--base-url <url>", "API base URL");
}
