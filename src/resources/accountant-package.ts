import type { Result } from "../error";
import type { HttpTransport } from "../transport";
import type {
	AccountantSendOutcome,
	AccountantSendParams,
	AccountantSendRecord,
	AccountantSettingsResult,
	AccountantSettingsUpdateResult,
	AccountantUpdateParams,
} from "../types/company";

/** Monthly package for the accountant (`/companies/{companyId}/accountant-package`). */
export class AccountantPackageResource {
	constructor(private readonly http: HttpTransport) {}

	/** Accountant e-mail of the monthly package. */
	get(companyId: string): Promise<Result<AccountantSettingsResult>> {
		return this.http.request<AccountantSettingsResult>({
			method: "GET",
			path: `/companies/${encodeURIComponent(companyId)}/accountant-package`,
		});
	}

	/** Set the accountant e-mail. `accountantEmail: null` (or blank) turns the monthly send off. */
	update(
		companyId: string,
		params: AccountantUpdateParams,
	): Promise<Result<AccountantSettingsUpdateResult>> {
		return this.http.request<AccountantSettingsUpdateResult>({
			method: "PUT",
			path: `/companies/${encodeURIComponent(companyId)}/accountant-package`,
			body: params,
		});
	}

	/** Send the package of a month (`YYYY-MM`) to the accountant now. */
	send(companyId: string, params: AccountantSendParams): Promise<Result<AccountantSendOutcome>> {
		return this.http.request<AccountantSendOutcome>({
			method: "POST",
			path: `/companies/${encodeURIComponent(companyId)}/accountant-package/send`,
			body: params,
		});
	}

	/** Last 12 attempts to send the package to the accountant. */
	listSends(companyId: string): Promise<Result<AccountantSendRecord[]>> {
		return this.http.request<AccountantSendRecord[]>({
			method: "GET",
			path: `/companies/${encodeURIComponent(companyId)}/accountant-package/sends`,
		});
	}
}
