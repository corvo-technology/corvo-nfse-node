import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Corvo, type CorvoOptions } from "../client";

export interface CorvoConfigFile {
	apiKey?: string;
	baseUrl?: string;
}

export function configPath(): string {
	return process.env.CORVO_CONFIG_PATH ?? join(homedir(), ".config", "corvo", "config.json");
}

export function readConfig(): CorvoConfigFile {
	try {
		return JSON.parse(readFileSync(configPath(), "utf8")) as CorvoConfigFile;
	} catch {
		return {};
	}
}

export function writeConfig(patch: CorvoConfigFile): CorvoConfigFile {
	const next: CorvoConfigFile = { ...readConfig(), ...patch };
	const path = configPath();
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
	return next;
}

export interface ClientFlags {
	apiKey?: string;
	baseUrl?: string;
}

export function buildClient(flags: ClientFlags): Corvo {
	const config = readConfig();
	const options: CorvoOptions = {
		apiKey: flags.apiKey || process.env.CORVO_API_KEY || config.apiKey,
		baseUrl: flags.baseUrl || process.env.CORVO_BASE_URL || config.baseUrl,
	};
	return new Corvo(options);
}
