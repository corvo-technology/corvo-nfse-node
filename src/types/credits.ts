export interface CreditBalance {
	tenantId: string;
	balance: number;
	overageUnits: number;
	overageAmountCents: number;
	hardLimit: number | null;
}

export interface CreditPlan {
	id: string;
	slug: "free" | "developer" | "growth" | "scale" | "volume";
	name: string;
	description: string;
	monthlyCreditAllowance: number;
	dailyLimit: number | null;
	maxActiveCompanies: number;
	creditUnitPriceCents: number;
	throughputRps: number;
	includesWebhooks: boolean;
	includesXmlDownload: boolean;
	includesPdfDownload: boolean;
	includesApiKeys: boolean;
	supportTier: "community" | "email" | "priority";
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

/** `amount` is in credits, not BRL; fields ending in `Cents` are in centavos. */
export interface CreditTransaction {
	id: string;
	tenantId: string;
	type: string;
	amount: number;
	description?: string;
	source?: "subscription" | "avulso" | "bonus";
	amountBrlCents?: number;
	unitPriceCentsApplied?: number;
	planIdSnapshot?: string;
	reservedInvoiceId?: string;
	periodId?: string;
	isReservation?: boolean;
	relatedTransactionId?: string;
	createdAt: string;
}

export interface CreditHistoryParams {
	limit?: number;
	cursor?: string;
}

/** Public catalog entry (`GET /plans`): prices in centavos, monthly cycle only. */
export interface PlanQuote {
	slug: string;
	name: string;
	monthlyAllowance: number;
	basePriceCents: number;
	perCreditOverageCents: number;
	monthlyTotalCents: number;
	currency: "BRL";
}

/** Recommendation for a monthly volume (`GET /plans/quote`). Note the snake_case keys. */
export interface PlanRecommendation {
	volume: number;
	recommended_plan: string;
	plan_name: string;
	monthly_allowance: number;
	overage_credits: number;
	overage_cost_cents: number;
	base_price_cents: number;
	total_estimated_cents: number;
	currency: "BRL";
	billing_cycle: "monthly";
}
