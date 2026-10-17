import type { Result } from "../error";
import { type HttpTransport, mapPlain } from "../transport";
import type { Paginated } from "../types/common";
import type { PlanQuote, PlanRecommendation } from "../types/credits";

/** Public price catalog: it works without an API key being tied to any account data. */
export class PlansResource {
	constructor(private readonly http: HttpTransport) {}

	list(params: { limit?: number; cursor?: string } = {}): Promise<Result<Paginated<PlanQuote>>> {
		return this.http.list<PlanQuote>(
			"/plans",
			{ limit: params.limit, cursor: params.cursor },
			mapPlain,
		);
	}

	get(slug: string): Promise<Result<PlanQuote>> {
		return this.http.request<PlanQuote>({
			method: "GET",
			path: `/plans/${encodeURIComponent(slug)}`,
		});
	}

	/** Recommends a plan for `volume` invoices per month. `data` is `null` for an invalid volume. */
	quote(volume: number): Promise<Result<PlanRecommendation | null>> {
		return this.http.request<PlanRecommendation | null>({
			method: "GET",
			path: "/plans/quote",
			query: { volume },
		});
	}
}
