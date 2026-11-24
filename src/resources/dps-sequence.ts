import type { Result } from "../error";
import type { HttpTransport } from "../transport";
import type { DpsSequence, DpsSequenceSetParams } from "../types/company";

/** DPS numbering of a company (`/companies/{id}/dps-sequence`). */
export class DpsSequenceResource {
	constructor(private readonly http: HttpTransport) {}

	get(companyId: string): Promise<Result<DpsSequence>> {
		return this.http.request<DpsSequence>({
			method: "GET",
			path: `/companies/${encodeURIComponent(companyId)}/dps-sequence`,
		});
	}

	/**
	 * Continue the numbering from the last note issued elsewhere. A number below the current one is
	 * refused with `DPS_NUMBER_BELOW_CURRENT`.
	 */
	set(companyId: string, params: DpsSequenceSetParams): Promise<Result<DpsSequence>> {
		return this.http.request<DpsSequence>({
			method: "PUT",
			path: `/companies/${encodeURIComponent(companyId)}/dps-sequence`,
			body: params,
		});
	}
}
