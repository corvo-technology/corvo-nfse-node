import { BillingResource } from "./resources/billing";
import { CertificatesResource } from "./resources/certificates";
import { CnpjResource } from "./resources/cnpj";
import { CompaniesResource } from "./resources/companies";
import { CreditsResource } from "./resources/credits";
import { CustomersResource } from "./resources/customers";
import { FiscalPortalResource } from "./resources/fiscal-portal";
import { HealthResource } from "./resources/health";
import { ImportsResource } from "./resources/imports";
import { IntegrationsResource } from "./resources/integrations";
import { InvoicesResource } from "./resources/invoices";
import { PlansResource } from "./resources/plans";
import { SchedulesResource } from "./resources/schedules";
import { WebhooksResource } from "./resources/webhooks";
import { type FetchLike, HttpTransport } from "./transport";

export interface CorvoOptions {
	apiKey?: string;
	baseUrl?: string;
	prefix?: string;
	timeoutMs?: number;
	fetch?: FetchLike;
	allowInsecureHttp?: boolean;
}

const DEFAULT_BASE_URL = "https://api.corvo.tech";

export class Corvo {
	readonly billing: BillingResource;
	readonly certificates: CertificatesResource;
	readonly companies: CompaniesResource;
	readonly cnpj: CnpjResource;
	readonly credits: CreditsResource;
	readonly customers: CustomersResource;
	readonly fiscalPortal: FiscalPortalResource;
	readonly health: HealthResource;
	readonly imports: ImportsResource;
	readonly integrations: IntegrationsResource;
	readonly invoices: InvoicesResource;
	readonly plans: PlansResource;
	readonly schedules: SchedulesResource;
	readonly webhooks: WebhooksResource;

	constructor(options: CorvoOptions = {}) {
		const apiKey = options.apiKey || process.env.CORVO_API_KEY;
		if (!apiKey) {
			throw new Error("Corvo: apiKey is required — pass apiKey or set CORVO_API_KEY");
		}
		if (typeof globalThis.fetch !== "function" && options.fetch === undefined) {
			throw new Error("Corvo: Node.js 18+ is required (global fetch missing)");
		}
		const baseUrl = options.baseUrl || process.env.CORVO_BASE_URL || DEFAULT_BASE_URL;
		const http = new HttpTransport({
			apiKey,
			baseUrl,
			prefix: options.prefix,
			timeoutMs: options.timeoutMs,
			fetch: options.fetch,
			allowInsecureHttp: options.allowInsecureHttp,
		});
		this.billing = new BillingResource(http);
		this.certificates = new CertificatesResource(http);
		this.cnpj = new CnpjResource(http);
		this.credits = new CreditsResource(http);
		this.customers = new CustomersResource(http);
		this.fiscalPortal = new FiscalPortalResource(http);
		this.imports = new ImportsResource(http);
		this.integrations = new IntegrationsResource(http);
		this.schedules = new SchedulesResource(http);
		this.companies = new CompaniesResource(http);
		this.health = new HealthResource(http);
		this.webhooks = new WebhooksResource(http);
		this.invoices = new InvoicesResource(http);
		this.plans = new PlansResource(http);
	}
}
