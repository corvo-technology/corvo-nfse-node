import type { Result } from "../error";
import type { HttpTransport } from "../transport";
import type {
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
} from "../types/integration";

const connectionPath = (id: string): string =>
	`/integrations/connections/${encodeURIComponent(id)}`;

/** Payment-platform connections (`/integrations/connections`). */
class ConnectionsResource {
	constructor(private readonly http: HttpTransport) {}

	list(): Promise<Result<IntegrationConnection[]>> {
		return this.http.request<IntegrationConnection[]>({
			method: "GET",
			path: "/integrations/connections",
		});
	}

	/** `secrets` come back only here, once. */
	create(params: IntegrationConnectionCreateParams): Promise<Result<IntegrationConnectionCreated>> {
		return this.http.request<IntegrationConnectionCreated>({
			method: "POST",
			path: "/integrations/connections",
			body: params,
		});
	}

	get(id: string): Promise<Result<IntegrationConnection>> {
		return this.http.request<IntegrationConnection>({ method: "GET", path: connectionPath(id) });
	}

	/** Check the credentials and identify the external account. */
	validate(id: string): Promise<Result<IntegrationConnection>> {
		return this.http.request<IntegrationConnection>({
			method: "POST",
			path: `${connectionPath(id)}/validate`,
		});
	}

	/** Replace credentials (for example a rotated API key). */
	updateCredentials(
		id: string,
		credentials: Record<string, string>,
	): Promise<Result<IntegrationConnection>> {
		return this.http.request<IntegrationConnection>({
			method: "PUT",
			path: `${connectionPath(id)}/credentials`,
			body: { credentials },
		});
	}

	/** Start issuing invoices automatically. */
	activate(id: string): Promise<Result<IntegrationConnection>> {
		return this.http.request<IntegrationConnection>({
			method: "POST",
			path: `${connectionPath(id)}/activate`,
		});
	}

	/** Stop issuing; events are still recorded. */
	pause(id: string): Promise<Result<IntegrationConnection>> {
		return this.http.request<IntegrationConnection>({
			method: "POST",
			path: `${connectionPath(id)}/pause`,
		});
	}

	/** Disconnect for good. */
	disconnect(id: string): Promise<Result<IntegrationConnection>> {
		return this.http.request<IntegrationConnection>({
			method: "POST",
			path: `${connectionPath(id)}/disconnect`,
		});
	}

	listRules(id: string): Promise<Result<IntegrationRule[]>> {
		return this.http.request<IntegrationRule[]>({
			method: "GET",
			path: `${connectionPath(id)}/rules`,
		});
	}

	replaceRules(id: string, rules: IntegrationRuleInput[]): Promise<Result<IntegrationRule[]>> {
		return this.http.request<IntegrationRule[]>({
			method: "PUT",
			path: `${connectionPath(id)}/rules`,
			body: { rules },
		});
	}

	/** Recent events received for the connection. */
	listEvents(id: string, params: { limit?: number } = {}): Promise<Result<IntegrationEvent[]>> {
		return this.http.request<IntegrationEvent[]>({
			method: "GET",
			path: `${connectionPath(id)}/events`,
			query: { limit: params.limit },
		});
	}

	/** Recent operations (sales) and their invoice status. */
	listOperations(
		id: string,
		params: { limit?: number } = {},
	): Promise<Result<IntegrationOperation[]>> {
		return this.http.request<IntegrationOperation[]>({
			method: "GET",
			path: `${connectionPath(id)}/operations`,
			query: { limit: params.limit },
		});
	}
}

/** Operations of a connection (`/integrations/operations`). */
class OperationsResource {
	constructor(private readonly http: HttpTransport) {}

	/** Fill in the customer of an operation waiting for it. */
	completeCustomer(
		id: string,
		params: IntegrationCompleteCustomerParams,
	): Promise<Result<IntegrationOperation>> {
		return this.http.request<IntegrationOperation>({
			method: "PATCH",
			path: `/integrations/operations/${encodeURIComponent(id)}/customer`,
			body: params,
		});
	}

	/** Try to issue the invoice of an operation again. */
	retry(id: string): Promise<Result<IntegrationOperationRetry>> {
		return this.http.request<IntegrationOperationRetry>({
			method: "POST",
			path: `/integrations/operations/${encodeURIComponent(id)}/retry`,
		});
	}
}

export class IntegrationsResource {
	readonly connections: ConnectionsResource;
	readonly operations: OperationsResource;

	constructor(private readonly http: HttpTransport) {
		this.connections = new ConnectionsResource(http);
		this.operations = new OperationsResource(http);
	}

	/** The payment platforms Corvo can connect to. */
	listProviders(): Promise<Result<IntegrationProvider[]>> {
		return this.http.request<IntegrationProvider[]>({
			method: "GET",
			path: "/integrations/providers",
		});
	}
}
