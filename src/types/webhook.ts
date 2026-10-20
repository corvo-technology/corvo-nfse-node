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
] as const;

/** Events you can subscribe to. `webhook.test` is only sent by `webhooks.test()` and cannot be subscribed. */
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface Webhook {
	id: string;
	url: string;
	events: WebhookEvent[];
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface WebhookWithSecret extends Webhook {
	secret: string;
}

export interface WebhookCreateParams {
	url: string;
	events: WebhookEvent[];
}

export interface WebhookListParams {
	limit?: number;
	cursor?: string;
}

export interface WebhookDelivery {
	id: string;
	tenantId: string;
	webhookConfigId: string;
	eventType: string;
	environment: "test" | "live";
	url: string;
	payload?: Record<string, unknown>;
	statusCode?: number | null;
	responseBody?: unknown;
	errorMessage?: string | null;
	status: "pending" | "sent" | "delayed" | "failed" | "manual_retry";
	durationMs?: number | null;
	retryCount: number;
	nextRetryAt?: string | null;
	lastError?: string | null;
	createdAt: string;
}

export interface WebhookDeliveryStats {
	total: number;
	sent: number;
	failed: number;
	pending: number;
	delayed: number;
}

export interface WebhookDeliveryListParams {
	hours?: number;
	environment?: "test" | "live";
	limit?: number;
	cursor?: string;
}
