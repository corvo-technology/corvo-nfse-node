import type { Result } from "../error";
import type { HttpTransport } from "../transport";
import type { FiscalPortalStatus } from "../types/portal";

export class FiscalPortalResource {
	constructor(private readonly http: HttpTransport) {}

	/** Whether the national NFS-e portal is answering for this key's environment. */
	status(): Promise<Result<FiscalPortalStatus>> {
		return this.http.request<FiscalPortalStatus>({ method: "GET", path: "/fiscal-portal/status" });
	}
}
