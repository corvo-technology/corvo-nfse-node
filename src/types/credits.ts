import type {
	CreditBalance as CreditBalanceSchema,
	CreditTransaction as CreditTransactionSchema,
	Plan,
	PlanPrice,
	PurchasePreview,
} from "./openapi";

/**
 * `balance` is the plan notes left (`planRemaining`) plus the loose notes bought separately
 * (`avulsoBalance`). There is no overage billing.
 */
export type CreditBalance = CreditBalanceSchema;

/** `slug` is `free`, `self-hosted`, `solo`, `equipe`, `empresa` or `escala`; treat it as open. */
export type CreditPlan = Plan;

/** `amount` is in credits, not BRL; fields ending in `Cents` are in centavos. */
export type CreditTransaction = CreditTransactionSchema;

export interface CreditHistoryParams {
	limit?: number;
	cursor?: string;
}

/** `GET /credits/purchase/preview?units=N`: R$ 0,99 each, at least 3 notes. */
export type CreditPurchasePreview = PurchasePreview;

/** Public catalog entry (`GET /plans`, no API key): prices in centavos for the chosen billing cycle. */
export type PlanQuote = PlanPrice;

export type PlanCycle = "monthly" | "annual";

/** Recommendation for a monthly volume (`GET /plans/quote`). Note the snake_case keys. */
export interface PlanRecommendation {
	volume: number;
	recommended_plan: string;
	plan_name: string;
	monthly_allowance: number;
	overage_credits?: number;
	overage_cost_cents?: number;
	base_price_cents: number;
	total_estimated_cents: number;
	currency: "BRL";
	billing_cycle: "monthly";
}
