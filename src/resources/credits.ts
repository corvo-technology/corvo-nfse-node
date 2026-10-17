import type { Result } from "../error";
import { type HttpTransport, mapPlain } from "../transport";
import type { Paginated } from "../types/common";
import type {
	CreditBalance,
	CreditHistoryParams,
	CreditPlan,
	CreditTransaction,
} from "../types/credits";

export class CreditsResource {
	constructor(private readonly http: HttpTransport) {}

	balance(): Promise<Result<CreditBalance>> {
		return this.http.request<CreditBalance>({ method: "GET", path: "/credits" });
	}

	plans(params: { limit?: number; cursor?: string } = {}): Promise<Result<Paginated<CreditPlan>>> {
		return this.http.list<CreditPlan>(
			"/credits/plans",
			{ limit: params.limit, cursor: params.cursor },
			mapPlain,
		);
	}

	history(params: CreditHistoryParams = {}): Promise<Result<Paginated<CreditTransaction>>> {
		return this.http.list<CreditTransaction>(
			"/credits/history",
			{ limit: params.limit, cursor: params.cursor },
			mapPlain,
		);
	}

	iterateHistory(
		params: CreditHistoryParams = {},
	): AsyncGenerator<CreditTransaction, void, undefined> {
		return this.http.iterate<CreditTransaction>(
			"/credits/history",
			{ limit: params.limit, cursor: params.cursor },
			mapPlain,
		);
	}
}
