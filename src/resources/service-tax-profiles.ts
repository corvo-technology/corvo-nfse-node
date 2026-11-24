import type { Result } from "../error";
import type { HttpTransport } from "../transport";
import type {
	ServiceTaxProfile,
	ServiceTaxProfileCreateParams,
	ServiceTaxProfileUpdateParams,
} from "../types/company";

/** Service tax profiles of a company catalog (`/companies/{id}/service-tax-profiles`). */
export class ServiceTaxProfilesResource {
	constructor(private readonly http: HttpTransport) {}

	/** Profiles effective on `date` (`YYYY-MM-DD`, default today). */
	list(companyId: string, params: { date?: string } = {}): Promise<Result<ServiceTaxProfile[]>> {
		return this.http.request<ServiceTaxProfile[]>({
			method: "GET",
			path: `/companies/${encodeURIComponent(companyId)}/service-tax-profiles`,
			query: { date: params.date },
		});
	}

	create(
		companyId: string,
		params: ServiceTaxProfileCreateParams,
	): Promise<Result<ServiceTaxProfile>> {
		return this.http.request<ServiceTaxProfile>({
			method: "POST",
			path: `/companies/${encodeURIComponent(companyId)}/service-tax-profiles`,
			body: params,
		});
	}

	update(
		companyId: string,
		serviceId: string,
		params: ServiceTaxProfileUpdateParams,
	): Promise<Result<ServiceTaxProfile>> {
		return this.http.request<ServiceTaxProfile>({
			method: "PATCH",
			path: `/companies/${encodeURIComponent(companyId)}/service-tax-profiles/${encodeURIComponent(serviceId)}`,
			body: params,
		});
	}

	/** Delete an expired, not yet approved profile. */
	remove(companyId: string, serviceId: string): Promise<Result<Record<string, unknown> | null>> {
		return this.http.request<Record<string, unknown> | null>({
			method: "DELETE",
			path: `/companies/${encodeURIComponent(companyId)}/service-tax-profiles/${encodeURIComponent(serviceId)}`,
		});
	}

	approve(companyId: string, serviceId: string): Promise<Result<ServiceTaxProfile>> {
		return this.http.request<ServiceTaxProfile>({
			method: "POST",
			path: `/companies/${encodeURIComponent(companyId)}/service-tax-profiles/${encodeURIComponent(serviceId)}/approve`,
		});
	}
}
