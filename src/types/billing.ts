import type { BillingPlan, QuotaStatus as QuotaStatusSchema } from "./openapi";

/** Snake_case on purpose: `/billing/plan` answers in snake_case. */
export type BillingPlanResponse = BillingPlan;
export type QuotaStatus = QuotaStatusSchema;
