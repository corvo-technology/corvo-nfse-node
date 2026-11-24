import type { Result } from "../error";
import { type DownloadedFile, type HttpTransport, type Query, mapPlain } from "../transport";
import type { Paginated } from "../types/common";
import type {
	Invoice,
	InvoiceBatchItem,
	InvoiceBatchSummary,
	InvoiceCalculation,
	InvoiceCancelParams,
	InvoiceCreateParams,
	InvoiceDownloadUrl,
	InvoiceEmailResult,
	InvoiceEvent,
	InvoiceImmediateCreateParams,
	InvoiceListParams,
	InvoiceOverview,
	InvoiceReviewParams,
	InvoiceReviewResult,
	InvoiceScheduleCreateParams,
	InvoiceSubstituteParams,
} from "../types/invoice";
import type { Schedule } from "../types/schedule";

export interface InvoiceIdempotencyOptions {
	idempotencyKey?: string;
}

export interface InvoiceEmailOptions extends InvoiceIdempotencyOptions {
	/** Send to this address instead of the customer's. */
	email?: string;
}

export class InvoicesResource {
	constructor(private readonly http: HttpTransport) {}

	/**
	 * Issue an invoice, or schedule one (`POST /invoices`). With `options.type` `IMMEDIATE` (the
	 * default) the answer is the queued `Invoice`; with `SCHEDULE` or `RECURRING` it is the
	 * `Schedule` (snake_case fields), and the note only exists when the schedule runs. Use
	 * `isSchedule` to tell the two apart when the type is not known at compile time.
	 */
	create(
		params: InvoiceScheduleCreateParams,
		options?: InvoiceIdempotencyOptions,
	): Promise<Result<Schedule>>;
	create(
		params: InvoiceImmediateCreateParams,
		options?: InvoiceIdempotencyOptions,
	): Promise<Result<Invoice>>;
	create(
		params: InvoiceCreateParams,
		options?: InvoiceIdempotencyOptions,
	): Promise<Result<Invoice | Schedule>>;
	create(
		params: InvoiceCreateParams,
		options: InvoiceIdempotencyOptions = {},
	): Promise<Result<Invoice | Schedule>> {
		return this.http.request<Invoice | Schedule>({
			method: "POST",
			path: "/invoices",
			body: params,
			idempotencyKey: options.idempotencyKey,
		});
	}

	/**
	 * Request the issuance of 1 to 50 invoices in one call (`POST /invoices/batches`), for one
	 * company or several. Items are checked one by one: valid ones are saved together, invalid ones
	 * come back `rejected` with the reason and are not saved. Match `results[].index` to the item
	 * you sent, fix only the rejected ones and send them again. Send an `idempotencyKey` per item: the
	 * `Idempotency-Key` header is not used by this route.
	 */
	createBatch(invoices: InvoiceBatchItem[]): Promise<Result<InvoiceBatchSummary>> {
		return this.http.request<InvoiceBatchSummary>({
			method: "POST",
			path: "/invoices/batches",
			body: { invoices },
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

	/** Request the invoice e-mail (`POST /invoices/{id}/email`), to the customer or to `options.email`. */
	sendEmail(id: string, options: InvoiceEmailOptions = {}): Promise<Result<InvoiceEmailResult>> {
		return this.http.request<InvoiceEmailResult>({
			method: "POST",
			path: `/invoices/${encodeURIComponent(id)}/email`,
			body: options.email !== undefined ? { email: options.email } : undefined,
			idempotencyKey: options.idempotencyKey,
		});
	}

	/**
	 * Replace an authorized invoice with a corrected one (`POST /invoices/{id}/substitute`): only
	 * `description` (why), `service.description`, `purchaseOrder` and `notes` can change.
	 */
	substitute(
		id: string,
		params: InvoiceSubstituteParams,
		options: InvoiceIdempotencyOptions = {},
	): Promise<Result<Invoice>> {
		return this.http.request<Invoice>({
			method: "POST",
			path: `/invoices/${encodeURIComponent(id)}/substitute`,
			body: params,
			idempotencyKey: options.idempotencyKey,
		});
	}

	/** Counts and daily activity of the key's environment (`GET /invoices/overview`). */
	overview(params: { period?: "7d" | "30d" } = {}): Promise<Result<InvoiceOverview>> {
		return this.http.request<InvoiceOverview>({
			method: "GET",
			path: "/invoices/overview",
			query: { period: params.period },
		});
	}

	/**
	 * Resolve invoices in `manual_review` (up to 100): `retry` sends the same DPS again, `discard`
	 * rejects it once the portal confirms the DPS was never registered.
	 */
	review(params: InvoiceReviewParams): Promise<Result<InvoiceReviewResult>> {
		return this.http.request<InvoiceReviewResult>({
			method: "POST",
			path: "/invoices/review",
			body: params,
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
			customerTaxId: params.customerTaxId,
			limit: params.limit,
			cursor: params.cursor,
		};
	}
}
