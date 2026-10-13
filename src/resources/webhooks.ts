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

	retry(deliveryId: string): Promise<Result<{ retried: boolean }>> {
		return this.http.request<{ retried: boolean }>({
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

	remove(id: string): Promise<Result<{ deleted: boolean }>> {
		return this.http.request<{ deleted: boolean }>({
			method: "DELETE",
			path: `/webhooks/${encodeURIComponent(id)}`,
		});
	}

	test(id: string): Promise<Result<{ sent: boolean }>> {
		return this.http.request<{ sent: boolean }>({
			method: "POST",
			path: `/webhooks/${encodeURIComponent(id)}/test`,
		});
	}
}
