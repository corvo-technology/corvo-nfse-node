export interface CreditBalance {
	tenantId: string;
	balance: number;
	overageUnits: number;
	overageAmountCents: number;
	hardLimit: number | null;
}

export interface CreditPlan {
	id: string;
	slug: string;
	name: string;
	description: string;
	dailyLimit: number;
	maxActiveCompanies: number;
	creditUnitPriceCents: number;
	throughputRps: number;
	includesWebhooks: boolean;
	includesXmlDownload: boolean;
	includesPdfDownload: boolean;
	includesApiKeys: boolean;
	supportTier: string;
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CreditTransaction {
	id: string;
	type: string;
	amount: number;
	creditDelta: number;
	balanceAfter: number;
	environment: "test" | "live";
	source: string;
	referenceType: string | null;
	referenceId: string | null;
	createdAt: string;
}

export interface CreditHistoryParams {
	limit?: number;
	cursor?: string;
}
