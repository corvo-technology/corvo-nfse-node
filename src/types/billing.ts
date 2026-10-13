export interface BillingPlanResponse {
	plan: {
		slug: string;
		name: string;
		monthly_allowance: number;
		daily_limit: number | null;
		max_active_companies: number;
		monthly_price_cents: number;
	};
	subscription: {
		status: string;
		paid_until: string | null;
		cancel_at_period_end: boolean;
		scheduled_plan: string | null;
		blocked: boolean;
	};
	usage: {
		overage_units: number;
		overage_amount_cents: number;
		hard_limit: number | null;
		credits_used: number;
		credits_reserved: number;
		credits_remaining: number;
		monthly_allowance: number;
		daily_usage: number;
		daily_limit: number | null;
		active_companies: number;
		max_active_companies: number;
		period_start: string | null;
		period_end: string | null;
	};
}

export interface QuotaStatus {
	canEmit: boolean;
	creditsRemaining: number;
	creditsUsed: number;
	creditsReserved: number;
	monthlyAllowance: number;
	dailyUsage: number;
	dailyLimit: number | null;
	activeCompanies: number;
	maxActiveCompanies: number;
	periodStart: string | null;
	periodEnd: string | null;
}
