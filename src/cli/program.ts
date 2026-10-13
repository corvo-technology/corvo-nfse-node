import { Command } from "commander";
import { VERSION } from "../index";
import { registerBilling } from "./commands/billing";
import { registerCertificates } from "./commands/certificates";
import { registerCompanies } from "./commands/companies";
import { registerCredits } from "./commands/credits";
import { registerHealth } from "./commands/health";
import { registerInvoices } from "./commands/invoices";
import { registerWebhooks } from "./commands/webhooks";
import { buildClient, configPath, readConfig, writeConfig } from "./config";
import type { CliOptions } from "./options";
import { failFatal, printJson } from "./output";

const CONFIG_KEYS = ["apiKey", "baseUrl"] as const;
type ConfigKey = (typeof CONFIG_KEYS)[number];

function isConfigKey(key: string): key is ConfigKey {
	return (CONFIG_KEYS as readonly string[]).includes(key);
}

export function createProgram(): Command {
	const program = new Command();
	program.name("corvo").description("Corvo NFS-e API CLI").version(VERSION);

	const config = program.command("config").description("Manage CLI configuration");
	config
		.command("set")
		.description("Set a config value (apiKey, baseUrl)")
		.argument("<key>")
		.argument("<value>")
		.action((key: string, value: string) => {
			if (!isConfigKey(key))
				failFatal(`Unknown config key: ${key} (expected ${CONFIG_KEYS.join(", ")})`);
			writeConfig({ [key]: value });
			process.stdout.write(`${key} saved to ${configPath()}\n`);
		});

	config
		.command("get")
		.description("Print a config value")
		.argument("<key>")
		.action((key: string) => {
			if (!isConfigKey(key))
				failFatal(`Unknown config key: ${key} (expected ${CONFIG_KEYS.join(", ")})`);
			const value = readConfig()[key];
			process.stdout.write(`${value ?? ""}\n`);
		});

	config
		.command("list")
		.description("Print the effective configuration sources")
		.action(function (this: Command) {
			const opts = this.opts() as CliOptions;
			const file = readConfig();
			const masked = file.apiKey ? `${file.apiKey.slice(0, 14)}...` : undefined;
			printJson({
				configPath: configPath(),
				file: { apiKey: masked, baseUrl: file.baseUrl },
				env: {
					CORVO_API_KEY: process.env.CORVO_API_KEY ? "set" : "unset",
					CORVO_BASE_URL: process.env.CORVO_BASE_URL ?? "unset",
				},
				flags: { apiKey: opts.apiKey ? "set" : "unset", baseUrl: opts.baseUrl ?? "unset" },
			});
		});

	config
		.command("path")
		.description("Print the config file path")
		.action(() => {
			process.stdout.write(`${configPath()}\n`);
		});

	registerCompanies(program);
	registerCertificates(program);
	registerInvoices(program);
	registerWebhooks(program);
	registerCredits(program);
	registerBilling(program);
	registerHealth(program);

	return program;
}

export function main(): void {
	createProgram()
		.parseAsync(process.argv)
		.catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`Error: ${message}\n`);
			process.exit(1);
		});
}

export { buildClient };
