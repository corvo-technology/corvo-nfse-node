import type { Result } from "../error";
import type { HttpTransport } from "../transport";
import type { BillingPlanResponse, QuotaStatus } from "../types/billing";

export class BillingResource {
	constructor(private readonly http: HttpTransport) {}

	plan(): Promise<Result<BillingPlanResponse>> {
		return this.http.request<BillingPlanResponse>({ method: "GET", path: "/billing/plan" });
	}

	usage(): Promise<Result<QuotaStatus>> {
		return this.http.request<QuotaStatus>({ method: "GET", path: "/billing/usage" });
	}
}
