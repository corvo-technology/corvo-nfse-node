import type { Result } from "../error";
import { type HttpTransport, type Query, mapPlain } from "../transport";
import type { Paginated } from "../types/common";
import type { Company, CompanyCreateParams, CompanyUpdateParams } from "../types/company";
import { AccountantPackageResource } from "./accountant-package";
import { DpsSequenceResource } from "./dps-sequence";
import { FiscalProfilesResource } from "./fiscal-profiles";
import { InvoicePackageResource } from "./invoice-package";
import { ServiceFavoritesResource } from "./service-favorites";
import { ServiceTaxProfilesResource } from "./service-tax-profiles";

export interface CompanyListParams {
	limit?: number;
	cursor?: string;
}

function listQuery(params: CompanyListParams): Query {
	return { limit: params.limit, cursor: params.cursor };
}

export class CompaniesResource {
	readonly accountantPackage: AccountantPackageResource;
	readonly dpsSequence: DpsSequenceResource;
	readonly fiscalProfiles: FiscalProfilesResource;
	readonly invoicePackage: InvoicePackageResource;
	readonly serviceFavorites: ServiceFavoritesResource;
	readonly serviceTaxProfiles: ServiceTaxProfilesResource;

	constructor(private readonly http: HttpTransport) {
		this.accountantPackage = new AccountantPackageResource(http);
		this.dpsSequence = new DpsSequenceResource(http);
		this.fiscalProfiles = new FiscalProfilesResource(http);
		this.invoicePackage = new InvoicePackageResource(http);
		this.serviceFavorites = new ServiceFavoritesResource(http);
		this.serviceTaxProfiles = new ServiceTaxProfilesResource(http);
	}

	create(params: CompanyCreateParams): Promise<Result<Company>> {
		return this.http.request<Company>({ method: "POST", path: "/companies", body: params });
	}

	list(params: CompanyListParams = {}): Promise<Result<Paginated<Company>>> {
		return this.http.list<Company>("/companies", listQuery(params), mapPlain);
	}

	iterate(params: CompanyListParams = {}): AsyncGenerator<Company, void, undefined> {
		return this.http.iterate<Company>("/companies", listQuery(params), mapPlain);
	}

	get(id: string): Promise<Result<Company>> {
		return this.http.request<Company>({
			method: "GET",
			path: `/companies/${encodeURIComponent(id)}`,
		});
	}

	update(id: string, params: CompanyUpdateParams): Promise<Result<Company>> {
		return this.http.request<Company>({
			method: "PATCH",
			path: `/companies/${encodeURIComponent(id)}`,
			body: params,
		});
	}

	remove(id: string): Promise<Result<Record<string, unknown> | null>> {
		return this.http.request<Record<string, unknown> | null>({
			method: "DELETE",
			path: `/companies/${encodeURIComponent(id)}`,
		});
	}
}
