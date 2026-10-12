import { HealthResource } from "./resources/health";
import { type FetchLike, HttpTransport } from "./transport";

export interface CorvoOptions {
	apiKey?: string;
	baseUrl?: string;
	prefix?: string;
	timeoutMs?: number;
	fetch?: FetchLike;
	allowInsecureHttp?: boolean;
}

const DEFAULT_BASE_URL = "https://api.corvo.tech";

export class Corvo {
	readonly health: HealthResource;

	constructor(options: CorvoOptions = {}) {
		const apiKey = options.apiKey || process.env.CORVO_API_KEY;
		if (!apiKey) {
			throw new Error("Corvo: apiKey is required — pass apiKey or set CORVO_API_KEY");
		}
		if (typeof globalThis.fetch !== "function" && options.fetch === undefined) {
			throw new Error("Corvo: Node.js 18+ is required (global fetch missing)");
		}
		const baseUrl = options.baseUrl || process.env.CORVO_BASE_URL || DEFAULT_BASE_URL;
		const http = new HttpTransport({
			apiKey,
			baseUrl,
			prefix: options.prefix,
			timeoutMs: options.timeoutMs,
			fetch: options.fetch,
			allowInsecureHttp: options.allowInsecureHttp,
		});
		this.health = new HealthResource(http);
	}
}
