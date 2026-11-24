export { VERSION } from "./version";

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
	AccountantSendOutcome,
	AccountantSendParams,
	AccountantSendRecord,
	AccountantSettingsResult,
	AccountantSettingsUpdateResult,
	AccountantUpdateParams,
	Company,
	CompanyAddressInput,
	CompanyCreateParams,
	CompanyUpdateParams,
	DpsSequence,
	DpsSequenceSetParams,
	FiscalProfile,
	FiscalProfileUpsertParams,
	ServiceFavorite,
	ServiceFavoriteCreateParams,
	ServiceTaxProfile,
	ServiceTaxProfileCreateParams,
	ServiceTaxProfileUpdateParams,
	TaxRegime,
} from "./types/company";
export type { Certificate, CertificateUploadParams } from "./types/certificate";
export type {
	CnpjProfile,
	Customer,
	CustomerSearchParams,
	CustomerUpdateParams,
} from "./types/customer";
export type { FiscalPortalStatus } from "./types/portal";
export {
	INVOICE_CANCELLATION_REASONS,
	type CalculatedTax,
	type CalculatedTaxAmount,
	type Invoice,
	type InvoiceBatchError,
	type InvoiceBatchItem,
	type InvoiceBatchParams,
	type InvoiceBatchResult,
	type InvoiceBatchSummary,
	type InvoiceCalculation,
	type InvoiceCancellationReason,
	type InvoiceCancelParams,
	type InvoiceCreateParams,
	type InvoiceCustomerAddress,
	type InvoiceCustomerInput,
	type InvoiceDownloadUrl,
	type InvoiceEmailResult,
	type InvoiceEvent,
	type InvoiceForeignCustomer,
	type InvoiceImmediateCreateParams,
	type InvoiceListParams,
	type InvoiceOptionsInput,
	type InvoiceOverview,
	type InvoicePackageSummary,
	type InvoiceRecurrence,
	type InvoiceReviewParams,
	type InvoiceReviewResult,
	type InvoiceScheduleCreateParams,
	type InvoiceServiceFiscal,
	type InvoiceServiceInput,
	type InvoiceServiceSnapshot,
	type InvoiceStage,
	type InvoiceStatus,
	type InvoiceSubstituteParams,
	type InvoiceSubstituteService,
} from "./types/invoice";
export {
	isSchedule,
	type Schedule,
	type ScheduleListParams,
	type ScheduleRun,
	type ScheduleRunListParams,
	type ScheduleStatus,
	type ScheduleUpdateParams,
} from "./types/schedule";
export type {
	ImportEmitParams,
	ImportJob,
	ImportRow,
	ImportRowListParams,
	ImportRowUpdateParams,
	ImportStartParams,
	ImportStarted,
} from "./types/import";
export type {
	IntegrationCompleteCustomerParams,
	IntegrationConnection,
	IntegrationConnectionCreateParams,
	IntegrationConnectionCreated,
	IntegrationEvent,
	IntegrationOperation,
	IntegrationOperationRetry,
	IntegrationProvider,
	IntegrationRule,
	IntegrationRuleInput,
} from "./types/integration";
export {
	WEBHOOK_EVENTS,
	type Webhook,
	type WebhookCreateParams,
	type WebhookDelivery,
	type WebhookDeliveryListParams,
	type WebhookDeliveryStats,
	type WebhookEvent,
	type WebhookListParams,
	type WebhookTestResult,
	type WebhookWithSecret,
} from "./types/webhook";
export type {
	CreditBalance,
	CreditHistoryParams,
	CreditPlan,
	CreditPurchasePreview,
	CreditTransaction,
	PlanQuote,
	PlanRecommendation,
} from "./types/credits";
export type { BillingPlanResponse, QuotaStatus } from "./types/billing";
export type * as Schemas from "./types/openapi";
export type { CompanyListParams } from "./resources/companies";
export type { CertificateListParams } from "./resources/certificates";
export type { InvoiceEmailOptions, InvoiceIdempotencyOptions } from "./resources/invoices";
export type { InvoicePackageDownloadParams } from "./resources/invoice-package";
