export type InvoiceStatus =
	| "queued"
	| "processing"
	| "authorized"
	| "rejected"
	| "retry_pending"
	| "reconciliation_required"
	| "manual_review"
	| "failed"
	| "cancelling"
	| "cancelled";

/** Why an invoice is being cancelled (`reason` in `invoices.cancel`). */
export const INVOICE_CANCELLATION_REASONS = [
	"issue_error",
	"service_not_provided",
	"other",
] as const;

export type InvoiceCancellationReason = (typeof INVOICE_CANCELLATION_REASONS)[number];

export interface InvoiceCancelParams {
	reason: InvoiceCancellationReason;
	/**
	 * Free-text justification, up to 255 characters. The API requires 15-255 characters to cancel
	 * an authorized or processing invoice; it is optional for a queued one.
	 */
	description?: string;
}

export type InvoiceStage = "pending" | "authorized" | "documents_ready" | "completed" | "failed";

export interface InvoiceCustomerInput {
	/** CPF or CNPJ. Required whenever a customer is sent; omit `customer` for an invoice without one. */
	taxId: string;
	name?: string;
	/** Required when the invoice must be emailed. */
	email?: string;
	address?: {
		street?: string;
		city?: string;
		state?: string;
		zip?: string;
		country?: string;
	};
}

export interface InvoiceCreateParams {
	/** The issuing company: send its id or its CNPJ (`companyId` wins when both are set). */
	companyId?: string;
	companyTaxId?: string;
	externalId?: string;
	customer?: InvoiceCustomerInput;
	service: {
		/** National service code (cTribNac, 6 digits). Defaults to the company's, then to `100901`. */
		code?: string;
		/** IBGE code of the place of service (7 digits). Defaults to the company's city. */
		municipalityCode?: string;
		description?: string;
	};
	/** Amount in BRL, positive, up to 2 decimal places. */
	amount: number;
	/** `YYYY-MM-DD`. A future date needs `options.type: "SCHEDULE"`. */
	competenceDate: string;
	/** Unconditional discount in BRL, from 0 up to `amount`, at most 2 decimal places. */
	discount?: number;
	/**
	 * Deduction from the ISS base declared by the issuer, in BRL: greater than 0 and less than
	 * `amount` minus `discount`, at most 2 decimal places (`0` is the same as omitting it). The
	 * invoice is still issued for the full amount; the issuer is responsible for the declared value.
	 */
	deduction?: number;
	/** Request the email notification (default `false`). `options.email.send` wins when set. */
	email?: boolean;
	options?: {
		email?: { send?: boolean };
		type?: "IMMEDIATE" | "SCHEDULE";
	};
}

export interface Invoice {
	id: string;
	companyId: string;
	tenantId: string;
	environment: "test" | "live";
	documentKeyVersion: number;
	emailSnapshot: { send: boolean };
	externalId: string | null;
	idempotencyKey: string | null;
	status: InvoiceStatus;
	customerSnapshot: {
		name?: string;
		email?: string;
		taxId?: string;
		address?: { street?: string; city?: string; state?: string; zip?: string; country?: string };
	};
	serviceSnapshot: { code?: string; description?: string; municipalityCode?: string };
	taxSnapshot: Record<string, unknown>;
	amount: number;
	/** Unconditional discount, when one was declared. */
	discount?: number;
	/** Deduction from the ISS base, when one was declared. */
	deduction?: number;
	currency: string;
	competenceDate: string;
	dpsId: string | null;
	dpsSeries: string | null;
	dpsNumber: number | null;
	accessKey: string | null;
	nfseNumber: number | null;
	fiscalProvider: string | null;
	fiscalSchemaVersion: string | null;
	issuedAt: string | null;
	authorizedAt: string | null;
	lastErrorCode: string | null;
	lastErrorMessage: string | null;
	lastErrorProvider: string | null;
	documentsReadyAt: string | null;
	lastEmailStatus: string | null;
	lastEmailSentAt: string | null;
	createdAt: string;
	updatedAt: string;
	documentsStatus: "pending" | "ready";
	emailStatus: "queued" | "sent" | "failed" | null;
	stage: InvoiceStage;
	/** When a scheduled invoice is released for issuance (ISO), or `null` for an immediate one. */
	scheduledFor: string | null;
	/** Reason sent with `invoices.cancel`, or `null` when no cancellation was requested. */
	cancellationReason: InvoiceCancellationReason | null;
	cancellationDescription: string | null;
	/** When the invoice reached `cancelled` (ISO). */
	cancelledAt: string | null;
	/** When the cancellation was requested (ISO). */
	cancellationRequestedAt: string | null;
}

/** One item of `invoices.createBatch`: the fields of `InvoiceCreateParams` plus its own idempotency key. */
export interface InvoiceBatchItem extends InvoiceCreateParams {
	/** Up to 255 characters. Repeating it with the same content returns the saved invoice with `replayed: true`. */
	idempotencyKey?: string;
}

export interface InvoiceBatchError {
	code: string;
	message: string;
	details?: unknown;
}

export interface InvoiceBatchResult {
	/** Position of the item in the request, starting at 0. */
	index: number;
	status: "accepted" | "rejected";
	/** `true` when the item repeated an `idempotencyKey` already saved with the same content. */
	replayed?: true;
	/** Present when `status` is `accepted`. */
	invoice?: Invoice;
	/** Present when `status` is `rejected`; rejected items are not saved. */
	error?: InvoiceBatchError;
}

export interface InvoiceBatchSummary {
	total: number;
	accepted: number;
	rejected: number;
	/** One entry per item, in the order sent. */
	results: InvoiceBatchResult[];
}

export interface InvoiceEvent {
	id: string;
	invoiceId: string;
	fromStatus: InvoiceStatus | null;
	toStatus: InvoiceStatus;
	reason: string | null;
	createdAt: string;
}

export interface InvoiceListParams {
	companyId?: string;
	status?: InvoiceStatus;
	from?: string;
	to?: string;
	externalId?: string;
	limit?: number;
	cursor?: string;
}

export interface InvoiceDownloadUrl {
	downloadUrl: string;
	expiresAt: string;
	fileName: string;
	mimeType: string;
}

export interface InvoiceEmailResult {
	emailId: string;
	status: string;
}

export type CalculatedTax = "iss" | "cbs" | "ibsState" | "ibsCity" | "ibsTotal";

export interface CalculatedTaxAmount {
	base: string;
	/** Absent on `ibsTotal`, which sums the state and municipal IBS. */
	rate?: string;
	amount: string;
}

export interface InvoiceCalculation {
	preEmission: true;
	/** `blocked` means a fiscal gap (see `blocking` and `pendingFields`), not an HTTP error. */
	status: "ready" | "blocked";
	disclaimer: string;
	competenceDate: string;
	taxRegime: string | null;
	classification: Record<string, unknown>;
	applicability: Record<string, unknown>;
	taxes: Partial<Record<CalculatedTax, CalculatedTaxAmount>>;
	withholdings: Array<CalculatedTaxAmount & { tax: string }>;
	netReceivableAmount: string | null;
	collectionWaived: boolean | null;
	calculation: {
		source: string;
		calculatorVersion: string | null;
		rulesVersion: string;
		legalReferences: string[];
	};
	warnings: Array<{ code: string; message: string; step: string }>;
	pendingFields: Array<{ field: string; reason: string }>;
	blocking: { code: string; message: string; step: string } | null;
	trace: Array<{ step: string; status: string; durationMs: number; reason?: string }>;
}
