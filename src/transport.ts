import { CorvoApiError, type CorvoErrorDetail, type Result } from "./error";
import type { Paginated } from "./types/common";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface TransportOptions {
	apiKey: string;
	baseUrl: string;
	prefix?: string;
	timeoutMs?: number;
	fetch?: FetchLike;
	allowInsecureHttp?: boolean;
}

export type Query = Record<string, string | number | undefined>;

export type Unwrap = "data" | "none";

export interface RequestOptions {
	method: "GET" | "POST" | "PATCH" | "DELETE";
	path: string;
	query?: Query;
	body?: unknown;
	idempotencyKey?: string;
	unwrap?: Unwrap;
}

export interface DownloadedFile {
	buffer: Buffer;
	mimeType?: string;
	fileName?: string;
}

interface RawPage {
	data: unknown[];
	pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
}

const DEFAULT_TIMEOUT_MS = 30_000;

export const mapPlain = <T>(raw: unknown): T => raw as T;

function isPrivateHost(hostname: string): boolean {
	const host = hostname.toLowerCase();
	if (host === "localhost" || host === "[::1]" || host === "::1" || host.endsWith(".localhost")) {
		return true;
	}
	const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
	if (!ipv4) return false;
	const a = Number(ipv4[1]);
	const b = Number(ipv4[2]);
	return (
		a === 127 ||
		a === 10 ||
		a === 0 ||
		(a === 192 && b === 168) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 169 && b === 254)
	);
}

function errorMessage(cause: unknown): string {
	if (cause instanceof Error) return cause.message;
	return String(cause);
}

export class HttpTransport {
	private readonly apiKey: string;
	private readonly baseUrl: string;
	private readonly prefix: string;
	private readonly timeoutMs: number;
	private readonly fetchImpl: FetchLike;
	private readonly allowInsecureHttp: boolean;

	constructor(options: TransportOptions) {
		this.apiKey = options.apiKey;
		this.baseUrl = options.baseUrl.replace(/\/+$/, "");
		this.prefix = (options.prefix ?? "v1").replace(/^\/+|\/+$/g, "");
		this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
		this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
		this.allowInsecureHttp = options.allowInsecureHttp ?? false;
		this.validateBaseUrl();
	}

	private validateBaseUrl(): void {
		let parsed: URL;
		try {
			parsed = new URL(this.baseUrl);
		} catch {
			throw new Error(`Corvo: invalid baseUrl: ${this.baseUrl}`);
		}
		if (parsed.protocol === "http:" && !this.allowInsecureHttp && !isPrivateHost(parsed.hostname)) {
			throw new Error(
				`Corvo: http:// is only allowed for loopback/private hosts (got ${parsed.hostname}). Use https:// or pass allowInsecureHttp: true.`,
			);
		}
	}

	private buildUrl(path: string, query?: Query): string {
		const prefix = this.prefix ? `/${this.prefix}` : "";
		const url = new URL(`${this.baseUrl}${prefix}${path}`);
		for (const [key, value] of Object.entries(query ?? {})) {
			if (value !== undefined) url.searchParams.set(key, String(value));
		}
		return url.toString();
	}

	private buildHeaders(options: RequestOptions): {
		headers: Record<string, string>;
		body: RequestInit["body"];
	} {
		const headers: Record<string, string> = {
			"X-API-Key": this.apiKey,
			Accept: "application/json",
		};
		let body: RequestInit["body"];
		if (options.body instanceof FormData) {
			body = options.body;
		} else if (options.body !== undefined) {
			headers["Content-Type"] = "application/json";
			body = JSON.stringify(options.body);
		}
		if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
		return { headers, body };
	}

	private async fetchResponse(
		options: RequestOptions,
	): Promise<{ response: Response } | { error: CorvoApiError }> {
		const { headers, body } = this.buildHeaders(options);
		const controller = new AbortController();
		const timer =
			this.timeoutMs > 0 ? setTimeout(() => controller.abort(), this.timeoutMs) : undefined;
		try {
			const response = await this.fetchImpl(this.buildUrl(options.path, options.query), {
				method: options.method,
				headers,
				body,
				signal: controller.signal,
			});
			if (!response.ok) return { error: await this.toError(response) };
			return { response };
		} catch (cause) {
			const timedOut = controller.signal.aborted;
			return {
				error: new CorvoApiError({
					message: timedOut
						? `Request timed out after ${this.timeoutMs}ms`
						: `Network request failed: ${errorMessage(cause)}`,
					status: 0,
					code: timedOut ? "timeout" : "network_error",
					cause,
				}),
			};
		} finally {
			if (timer !== undefined) clearTimeout(timer);
		}
	}

	private async toError(response: Response): Promise<CorvoApiError> {
		const headerRequestId = response.headers.get("X-Request-Id") ?? undefined;
		const retryAfterHeader = response.headers.get("Retry-After");
		let parsed: unknown;
		try {
			parsed = await response.json();
		} catch {
			parsed = undefined;
		}
		const record: Record<string, unknown> =
			typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
		const code =
			typeof record.code === "string" && record.code.length > 0
				? record.code
				: `http_${response.status}`;
		let message: string;
		if (typeof record.message === "string") message = record.message;
		else if (Array.isArray(record.message)) message = record.message.map(String).join("; ");
		else if (typeof record.error === "string") message = record.error;
		else message = `Request failed with status ${response.status}`;
		const details = Array.isArray(record.details)
			? (record.details as CorvoErrorDetail[])
			: undefined;
		const requestId = typeof record.requestId === "string" ? record.requestId : headerRequestId;
		let retryAfter = typeof record.retryAfter === "number" ? record.retryAfter : undefined;
		if (
			retryAfter === undefined &&
			retryAfterHeader !== null &&
			Number.isFinite(Number(retryAfterHeader))
		) {
			retryAfter = Number(retryAfterHeader);
		}
		return new CorvoApiError({
			message,
			status: response.status,
			code,
			details,
			requestId,
			retryAfter,
		});
	}

	private unwrap(value: unknown, mode: Unwrap): unknown {
		if (mode === "none") return value;
		const envelope =
			value !== null && typeof value === "object" && "data" in value
				? (value as { data: unknown }).data
				: null;
		return envelope ?? null;
	}

	async request<T>(options: RequestOptions): Promise<Result<T>> {
		const out = await this.fetchResponse(options);
		if ("error" in out) return { error: out.error };
		const { response } = out;
		if (response.status === 204) return { data: null as T };
		const text = await response.text();
		if (text.length === 0) return { data: null as T };
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch (cause) {
			return {
				error: new CorvoApiError({
					message: "Invalid JSON in response",
					status: response.status,
					code: "invalid_json",
					requestId: response.headers.get("X-Request-Id") ?? undefined,
					cause,
				}),
			};
		}
		return { data: this.unwrap(parsed, options.unwrap ?? "data") as T };
	}

	async requestRaw(
		options: Omit<RequestOptions, "body" | "unwrap">,
	): Promise<Result<DownloadedFile>> {
		const out = await this.fetchResponse({ ...options, body: undefined, unwrap: "none" });
		if ("error" in out) return { error: out.error };
		const { response } = out;
		const buffer = Buffer.from(await response.arrayBuffer());
		const disposition = response.headers.get("Content-Disposition");
		const match = disposition ? /filename="([^"]+)"/.exec(disposition) : null;
		const mimeType = response.headers.get("Content-Type") ?? undefined;
		return { data: { buffer, mimeType, fileName: match?.[1] ?? undefined } };
	}

	async list<T>(
		path: string,
		query: Query | undefined,
		mapItem: (raw: unknown) => T,
	): Promise<Result<Paginated<T>>> {
		const res = await this.request<RawPage>({ method: "GET", path, query, unwrap: "none" });
		if (res.error) return { error: res.error };
		return { data: { data: res.data?.data.map(mapItem), pagination: res.data?.pagination } };
	}

	async *iterate<T>(
		path: string,
		query: Query | undefined,
		mapItem: (raw: unknown) => T,
	): AsyncGenerator<T, void, undefined> {
		let cursor = query?.cursor;
		for (;;) {
			const page = await this.list(path, { ...query, cursor }, mapItem);
			if (page.error) throw page.error;
			for (const item of page.data.data) yield item;
			if (!page.data.pagination.hasMore) return;
			const next = page.data.pagination.nextCursor;
			if (next === null) return;
			cursor = next;
		}
	}
}
