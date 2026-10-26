import type { Result } from "../error";
import { type DownloadedFile, type HttpTransport, type Query, mapPlain } from "../transport";
import type { Paginated } from "../types/common";
import type {
	Invoice,
	InvoiceCalculation,
	InvoiceCancelParams,
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
			idempotencyKey: options.idempotencyKey,
		});
	}

	/**
	 * Pre-emission tax estimate (`POST /invoices/calculate`): nothing is issued, stored or charged.
	 * A fiscal problem is not an error: it comes back with `status: "blocked"`.
	 */
	calculate(params: InvoiceCreateParams): Promise<Result<InvoiceCalculation>> {
		return this.http.request<InvoiceCalculation>({
			method: "POST",
			path: "/invoices/calculate",
			body: params,
		});
	}

	get(id: string): Promise<Result<Invoice>> {
		return this.http.request<Invoice>({
			method: "GET",
			path: `/invoices/${encodeURIComponent(id)}`,
		});
	}

	list(params: InvoiceListParams = {}): Promise<Result<Paginated<Invoice>>> {
		return this.http.list<Invoice>("/invoices", this.listQuery(params), mapPlain);
	}

	iterate(params: InvoiceListParams = {}): AsyncGenerator<Invoice, void, undefined> {
		return this.http.iterate<Invoice>("/invoices", this.listQuery(params), mapPlain);
	}

	events(
		id: string,
		params: { limit?: number; cursor?: string } = {},
	): Promise<Result<Paginated<InvoiceEvent>>> {
		return this.http.list<InvoiceEvent>(
			`/invoices/${encodeURIComponent(id)}/events`,
			{ limit: params.limit, cursor: params.cursor },
			mapPlain,
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

	/**
	 * Cancel an invoice (`POST /invoices/{id}/cancel`). A queued invoice is cancelled at once
	 * (`status: "cancelled"`); an authorized one moves to `cancelling` while the cancellation is
	 * processed, and a processing one keeps `processing` with `cancellationRequestedAt` set.
	 * Call `get` later to see the outcome: `cancelled` when done, or back to `authorized` with
	 * `lastErrorCode` when the cancellation was rejected.
	 */
	cancel(id: string, params: InvoiceCancelParams): Promise<Result<Invoice>> {
		return this.http.request<Invoice>({
			method: "POST",
			path: `/invoices/${encodeURIComponent(id)}/cancel`,
			body: params,
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
