export const VERSION = "0.1.0";

export { Corvo, type CorvoOptions } from "./client";
export {
	CorvoApiError,
	type CorvoApiErrorInit,
	type CorvoErrorDetail,
	type Result,
} from "./error";
export { CorvoWebhooks } from "./webhooks";
export type { DownloadedFile, Query, TransportOptions, Unwrap } from "./transport";

export type { Paginated, Pagination } from "./types/common";
export type {
	Company,
	CompanyAddressInput,
	CompanyCreateParams,
	CompanyUpdateParams,
	TaxRegime,
} from "./types/company";
export type { Certificate, CertificateUploadParams } from "./types/certificate";
export type {
	CalculatedTax,
	CalculatedTaxAmount,
	Invoice,
	InvoiceCalculation,
	InvoiceCreateParams,
	InvoiceCustomerInput,
	InvoiceDownloadUrl,
	InvoiceEmailResult,
	InvoiceEvent,
	InvoiceListParams,
	InvoiceStage,
	InvoiceStatus,
} from "./types/invoice";
export {
	WEBHOOK_EVENTS,
	type Webhook,
	type WebhookCreateParams,
	type WebhookDelivery,
	type WebhookDeliveryListParams,
	type WebhookDeliveryStats,
	type WebhookEvent,
	type WebhookWithSecret,
} from "./types/webhook";
export type {
	CreditBalance,
	CreditHistoryParams,
	CreditPlan,
	CreditTransaction,
	PlanQuote,
	PlanRecommendation,
} from "./types/credits";
export type { BillingPlanResponse, QuotaStatus } from "./types/billing";
export type { CompanyListParams } from "./resources/companies";
export type { CertificateListParams } from "./resources/certificates";
export type { InvoiceIdempotencyOptions } from "./resources/invoices";
