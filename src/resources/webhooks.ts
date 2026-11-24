import type { Result } from "../error";
import { type HttpTransport, type Query, mapPlain } from "../transport";
import type { Paginated } from "../types/common";
import type {
	Webhook,
	WebhookCreateParams,
	WebhookDelivery,
	WebhookDeliveryListParams,
	WebhookDeliveryStats,
	WebhookListParams,
	WebhookTestResult,
	WebhookWithSecret,
} from "../types/webhook";

class DeliveriesResource {
	constructor(private readonly http: HttpTransport) {}

	list(params: WebhookDeliveryListParams = {}): Promise<Result<Paginated<WebhookDelivery>>> {
		return this.http.list<WebhookDelivery>("/webhooks/deliveries", this.query(params), mapPlain);
	}

	iterate(
		params: WebhookDeliveryListParams = {},
	): AsyncGenerator<WebhookDelivery, void, undefined> {
		return this.http.iterate<WebhookDelivery>("/webhooks/deliveries", this.query(params), mapPlain);
	}

	stats(
		params: { hours?: number; environment?: "test" | "live" } = {},
	): Promise<Result<WebhookDeliveryStats>> {
		return this.http.request<WebhookDeliveryStats>({
			method: "GET",
			path: "/webhooks/deliveries/stats",
			query: { hours: params.hours, environment: params.environment },
		});
	}

	retry(deliveryId: string): Promise<Result<{ retried: true }>> {
		return this.http.request<{ retried: true }>({
			method: "POST",
			path: `/webhooks/deliveries/${encodeURIComponent(deliveryId)}/retry`,
		});
	}

	private query(params: WebhookDeliveryListParams): Query {
		return {
			hours: params.hours,
			environment: params.environment,
			limit: params.limit,
			cursor: params.cursor,
		};
	}
}

export class WebhooksResource {
	readonly deliveries: DeliveriesResource;

	constructor(private readonly http: HttpTransport) {
		this.deliveries = new DeliveriesResource(http);
	}

	list(params: WebhookListParams = {}): Promise<Result<Paginated<Webhook>>> {
		return this.http.list<Webhook>(
			"/webhooks",
			{ limit: params.limit, cursor: params.cursor },
			mapPlain,
		);
	}

	iterate(params: WebhookListParams = {}): AsyncGenerator<Webhook, void, undefined> {
		return this.http.iterate<Webhook>(
			"/webhooks",
			{ limit: params.limit, cursor: params.cursor },
			mapPlain,
		);
	}

	create(params: WebhookCreateParams): Promise<Result<WebhookWithSecret>> {
		return this.http.request<WebhookWithSecret>({
			method: "POST",
			path: "/webhooks",
			body: params,
		});
	}

	remove(id: string): Promise<Result<{ deleted: true }>> {
		return this.http.request<{ deleted: true }>({
			method: "DELETE",
			path: `/webhooks/${encodeURIComponent(id)}`,
		});
	}

	/** `data.sent` is `false` (with `error` and `statusCode`) when your endpoint did not accept the event. */
	test(id: string): Promise<Result<WebhookTestResult>> {
		return this.http.request<WebhookTestResult>({
			method: "POST",
			path: `/webhooks/${encodeURIComponent(id)}/test`,
		});
	}
}
