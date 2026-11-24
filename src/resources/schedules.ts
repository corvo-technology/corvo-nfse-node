import type { Result } from "../error";
import { type HttpTransport, type Query, mapPlain } from "../transport";
import type { Paginated } from "../types/common";
import type {
	Schedule,
	ScheduleListParams,
	ScheduleRun,
	ScheduleRunListParams,
	ScheduleUpdateParams,
} from "../types/schedule";

function listQuery(params: ScheduleListParams): Query {
	return {
		status: params.status,
		companyId: params.companyId,
		limit: params.limit,
		cursor: params.cursor,
	};
}

/**
 * Scheduled and recurring invoices (`/schedules`). Fields are snake_case. Create one with
 * `invoices.create` and `options.type` `SCHEDULE` or `RECURRING`.
 */
export class SchedulesResource {
	constructor(private readonly http: HttpTransport) {}

	list(params: ScheduleListParams = {}): Promise<Result<Paginated<Schedule>>> {
		return this.http.list<Schedule>("/schedules", listQuery(params), mapPlain);
	}

	iterate(params: ScheduleListParams = {}): AsyncGenerator<Schedule, void, undefined> {
		return this.http.iterate<Schedule>("/schedules", listQuery(params), mapPlain);
	}

	get(id: string): Promise<Result<Schedule>> {
		return this.http.request<Schedule>({
			method: "GET",
			path: `/schedules/${encodeURIComponent(id)}`,
		});
	}

	/** Change a schedule; applies to the next runs only. */
	update(id: string, params: ScheduleUpdateParams): Promise<Result<Schedule>> {
		return this.http.request<Schedule>({
			method: "PATCH",
			path: `/schedules/${encodeURIComponent(id)}`,
			body: params,
		});
	}

	pause(id: string): Promise<Result<Schedule>> {
		return this.http.request<Schedule>({
			method: "POST",
			path: `/schedules/${encodeURIComponent(id)}/pause`,
		});
	}

	/** Resume a paused schedule at its next occurrence. */
	resume(id: string): Promise<Result<Schedule>> {
		return this.http.request<Schedule>({
			method: "POST",
			path: `/schedules/${encodeURIComponent(id)}/resume`,
		});
	}

	/** Cancel a schedule (final). */
	cancel(id: string): Promise<Result<Schedule>> {
		return this.http.request<Schedule>({
			method: "POST",
			path: `/schedules/${encodeURIComponent(id)}/cancel`,
		});
	}

	/** Log of every attempt to run the schedule, newest first. */
	listRuns(
		id: string,
		params: ScheduleRunListParams = {},
	): Promise<Result<Paginated<ScheduleRun>>> {
		return this.http.list<ScheduleRun>(
			`/schedules/${encodeURIComponent(id)}/runs`,
			{ limit: params.limit, cursor: params.cursor },
			mapPlain,
		);
	}

	iterateRuns(
		id: string,
		params: ScheduleRunListParams = {},
	): AsyncGenerator<ScheduleRun, void, undefined> {
		return this.http.iterate<ScheduleRun>(
			`/schedules/${encodeURIComponent(id)}/runs`,
			{ limit: params.limit, cursor: params.cursor },
			mapPlain,
		);
	}
}
