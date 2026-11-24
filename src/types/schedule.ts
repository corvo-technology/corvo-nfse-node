import type {
	ScheduleRun as ScheduleRunSchema,
	Schedule as ScheduleSchema,
	UpdateSchedule,
} from "./openapi";

/** Snake_case on purpose: schedules answer in snake_case. */
export type Schedule = ScheduleSchema;
export type ScheduleRun = ScheduleRunSchema;
export type ScheduleStatus = ScheduleSchema["status"];
export type ScheduleUpdateParams = UpdateSchedule;

/** `true` when the `data` of `invoices.create` is a schedule (`SCHEDULE` or `RECURRING`). */
export function isSchedule(value: unknown): value is Schedule {
	return (
		typeof value === "object" &&
		value !== null &&
		"kind" in value &&
		"anchor_on" in value &&
		"company_id" in value
	);
}

export interface ScheduleListParams {
	status?: ScheduleStatus;
	companyId?: string;
	limit?: number;
	cursor?: string;
}

export interface ScheduleRunListParams {
	limit?: number;
	cursor?: string;
}
