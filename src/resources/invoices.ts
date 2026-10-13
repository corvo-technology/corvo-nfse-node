import type { Result } from "../error";
import { type DownloadedFile, type HttpTransport, type Query, mapProps } from "../transport";
import type { Paginated } from "../types/common";
import type {
	Invoice,
	InvoiceCreateParams,
	InvoiceDownloadUrl,
	InvoiceEmailResult,
	InvoiceEvent,
	InvoiceListParams,
} from "../types/invoice";

export interface InvoiceIdempotencyOptions {
	idempotencyKey?: string;
}

export class InvoicesResource {
	constructor(private readonly http: HttpTransport) {}

	create(
		params: InvoiceCreateParams,
		options: InvoiceIdempotencyOptions = {},
	): Promise<Result<Invoice>> {
		return this.http.request<Invoice>({
			method: "POST",
			path: "/invoices",
			body: params,
			unwrap: "data+props",
			idempotencyKey: options.idempotencyKey,
		});
	}

	get(id: string): Promise<Result<Invoice>> {
		return this.http.request<Invoice>({
			method: "GET",
			path: `/invoices/${encodeURIComponent(id)}`,
			unwrap: "data+props",
		});
	}

	list(params: InvoiceListParams = {}): Promise<Result<Paginated<Invoice>>> {
		return this.http.list<Invoice>("/invoices", this.listQuery(params), mapProps);
	}

	iterate(params: InvoiceListParams = {}): AsyncGenerator<Invoice, void, undefined> {
		return this.http.iterate<Invoice>("/invoices", this.listQuery(params), mapProps);
	}

	events(
		id: string,
		params: { limit?: number; cursor?: string } = {},
	): Promise<Result<Paginated<InvoiceEvent>>> {
		return this.http.list<InvoiceEvent>(
			`/invoices/${encodeURIComponent(id)}/events`,
			{ limit: params.limit, cursor: params.cursor },
			mapProps,
		);
	}

	pdf(id: string): Promise<Result<DownloadedFile>> {
		return this.http.requestRaw({ method: "GET", path: `/invoices/${encodeURIComponent(id)}/pdf` });
	}

	xml(id: string): Promise<Result<DownloadedFile>> {
		return this.http.requestRaw({ method: "GET", path: `/invoices/${encodeURIComponent(id)}/xml` });
	}

	downloadUrl(id: string, format: "pdf" | "xml"): Promise<Result<InvoiceDownloadUrl>> {
		return this.http.request<InvoiceDownloadUrl>({
			method: "POST",
			path: `/invoices/${encodeURIComponent(id)}/download-url`,
			body: { format },
		});
	}

	sendEmail(
		id: string,
		options: InvoiceIdempotencyOptions = {},
	): Promise<Result<InvoiceEmailResult>> {
		return this.http.request<InvoiceEmailResult>({
			method: "POST",
			path: `/invoices/${encodeURIComponent(id)}/email`,
			idempotencyKey: options.idempotencyKey,
		});
	}

	private listQuery(params: InvoiceListParams): Query {
		return {
			companyId: params.companyId,
			status: params.status,
			from: params.from,
			to: params.to,
			externalId: params.externalId,
			limit: params.limit,
			cursor: params.cursor,
		};
	}
}
