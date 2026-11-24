import type { Result } from "../error";
import type { HttpTransport } from "../transport";
import type { FiscalProfile, FiscalProfileUpsertParams } from "../types/company";

/** Fiscal profile history of a company (`/companies/{id}/fiscal-profile`). */
export class FiscalProfilesResource {
	constructor(private readonly http: HttpTransport) {}

	list(companyId: string): Promise<Result<FiscalProfile[]>> {
		return this.http.request<FiscalProfile[]>({
			method: "GET",
			path: `/companies/${encodeURIComponent(companyId)}/fiscal-profile`,
		});
	}

	/** Create a validity period (idempotent for an identical desired state). */
	upsert(companyId: string, params: FiscalProfileUpsertParams): Promise<Result<FiscalProfile>> {
		return this.http.request<FiscalProfile>({
			method: "PUT",
			path: `/companies/${encodeURIComponent(companyId)}/fiscal-profile`,
			body: params,
		});
	}

	approve(companyId: string, profileId: string): Promise<Result<FiscalProfile>> {
		return this.http.request<FiscalProfile>({
			method: "POST",
			path: `/companies/${encodeURIComponent(companyId)}/fiscal-profile/${encodeURIComponent(profileId)}/approve`,
		});
	}
}
