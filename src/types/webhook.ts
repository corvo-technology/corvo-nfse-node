import type {
	CreateWebhookConfig,
	WebhookDelivery as WebhookDeliverySchema,
	WebhookEventType,
	Webhook as WebhookSchema,
	WebhookStats,
	WebhookTestResult as WebhookTestResultSchema,
	WebhookWithSecret as WebhookWithSecretSchema,
} from "./openapi";

/** The 12 event types of the contract. */
export const WEBHOOK_EVENTS = [
	"nfse.invoice.authorized",
	"nfse.invoice.rejected",
	"nfse.invoice.failed",
	"nfse.invoice.reconciliation_required",
	"nfse.invoice.manual_review",
	"nfse.invoice.documents_ready",
	"nfse.invoice.email_sent",
	"nfse.invoice.email_failed",
	"nfse.invoice.fiscal_discrepancy",
	"nfse.invoice.cancelled",
	"nfse.invoice.cancellation_rejected",
	"nfse.invoice.taker_rejected",
] as const satisfies readonly WebhookEventType[];

/** Events you can subscribe to. `webhook.test` is only sent by `webhooks.test()` and cannot be subscribed. */
export type WebhookEvent = WebhookEventType;

/**
 * `environment` is `test` or `live`: a webhook created with an API key is tied to that key's
 * environment and only receives its events (`null` for older ones).
 */
export type Webhook = WebhookSchema;
export type WebhookWithSecret = WebhookWithSecretSchema;
export type WebhookCreateParams = CreateWebhookConfig;
export type WebhookDelivery = WebhookDeliverySchema;
export type WebhookDeliveryStats = WebhookStats;
export type WebhookTestResult = WebhookTestResultSchema;

export interface WebhookListParams {
	limit?: number;
	cursor?: string;
}

export interface WebhookDeliveryListParams {
	hours?: number;
	environment?: "test" | "live";
	limit?: number;
	cursor?: string;
}
