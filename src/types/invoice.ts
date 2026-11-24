import type {
	CalculationMetadata,
	CancelInvoice,
	CreateInvoice,
	CreateInvoiceBatch,
	CustomerAddress,
	ForeignCustomer,
	InvoiceBatch,
	InvoiceBatchError as InvoiceBatchErrorSchema,
	InvoiceBatchItem as InvoiceBatchItemSchema,
	InvoiceBatchResult as InvoiceBatchResultSchema,
	InvoiceCalculation as InvoiceCalculationSchema,
	InvoiceCustomer,
	InvoiceDownloadUrl as InvoiceDownloadUrlSchema,
	InvoiceEmailRequest,
	InvoiceEvent as InvoiceEventSchema,
	InvoiceOptions,
	InvoiceOverview as InvoiceOverviewSchema,
	InvoiceReviewResult as InvoiceReviewResultSchema,
	Invoice as InvoiceSchema,
	InvoiceService,
	PackageSummary,
	RecurrenceOptions,
	ReviewInvoices,
	ServiceFiscal,
	ServiceSnapshot,
	SubstituteInvoice,
	SubstituteService,
	TaxAmount,
} from "./openapi";

/** The 10 statuses of the contract. */
export type InvoiceStatus = InvoiceSchema["status"];

/** Why an invoice is being cancelled (`reason` in `invoices.cancel`). */
export const INVOICE_CANCELLATION_REASONS = [
	"issue_error",
	"service_not_provided",
	"other",
] as const;

export type InvoiceCancellationReason = (typeof INVOICE_CANCELLATION_REASONS)[number];

/**
 * `description` is free text, up to 255 characters. The API requires 15-255 characters to cancel
 * an authorized or processing invoice; it is optional for a queued one.
 */
export type InvoiceCancelParams = CancelInvoice;

export type InvoiceStage = InvoiceSchema["stage"];

export type InvoiceCustomerInput = InvoiceCustomer;
export type InvoiceCustomerAddress = CustomerAddress;
export type InvoiceForeignCustomer = ForeignCustomer;
export type InvoiceServiceInput = InvoiceService;
export type InvoiceServiceFiscal = ServiceFiscal;
export type InvoiceOptionsInput = InvoiceOptions;
export type InvoiceRecurrence = RecurrenceOptions;
export type InvoiceServiceSnapshot = ServiceSnapshot;

/** Body of `invoices.create`. `options.type` picks immediate (default), `SCHEDULE` or `RECURRING`. */
export type InvoiceCreateParams = CreateInvoice;

/** `options.type` is `SCHEDULE` or `RECURRING`: the API answers with a `Schedule`, not an invoice. */
export type InvoiceScheduleCreateParams = CreateInvoice & {
	options: InvoiceOptions & { type: "SCHEDULE" | "RECURRING" };
};

/** `options.type` is absent or `IMMEDIATE`: the API answers with the queued `Invoice`. */
export type InvoiceImmediateCreateParams = CreateInvoice & {
	options?: InvoiceOptions & { type?: "IMMEDIATE" };
};

export type Invoice = InvoiceSchema;
export type InvoiceBatchItem = InvoiceBatchItemSchema;
export type InvoiceBatchError = InvoiceBatchErrorSchema;
export type InvoiceBatchResult = InvoiceBatchResultSchema;
export type InvoiceBatchSummary = InvoiceBatch;
export type InvoiceBatchParams = CreateInvoiceBatch;
export type InvoiceEvent = InvoiceEventSchema;
export type InvoiceDownloadUrl = InvoiceDownloadUrlSchema;
export type InvoiceEmailResult = InvoiceEmailRequest;
export type InvoiceCalculation = InvoiceCalculationSchema;
export type InvoiceCalculationMetadata = CalculationMetadata;
export type InvoiceOverview = InvoiceOverviewSchema;
export type InvoiceReviewParams = ReviewInvoices;
export type InvoiceReviewResult = InvoiceReviewResultSchema;
export type InvoiceSubstituteParams = SubstituteInvoice;
export type InvoiceSubstituteService = SubstituteService;
export type InvoicePackageSummary = PackageSummary;

export type CalculatedTax = "iss" | "cbs" | "ibsState" | "ibsTotal" | "ibsCity";
export type CalculatedTaxAmount = TaxAmount;

export interface InvoiceListParams {
	companyId?: string;
	status?: InvoiceStatus;
	from?: string;
	to?: string;
	externalId?: string;
	/** CPF (11 digits) or CNPJ (14 digits) of the customer, digits only. */
	customerTaxId?: string;
	limit?: number;
	cursor?: string;
}
