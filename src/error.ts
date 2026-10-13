export interface CorvoErrorDetail {
	field: string;
	code: string;
	message: string;
}

export interface CorvoApiErrorInit {
	message: string;
	status: number;
	code: string;
	details?: CorvoErrorDetail[];
	requestId?: string;
	retryAfter?: number;
	cause?: unknown;
}

export class CorvoApiError extends Error {
	readonly status: number;
	readonly code: string;
	readonly details?: CorvoErrorDetail[];
	readonly requestId?: string;
	readonly retryAfter?: number;

	constructor(init: CorvoApiErrorInit) {
		super(init.message, init.cause !== undefined ? { cause: init.cause } : undefined);
		this.name = "CorvoApiError";
		this.status = init.status;
		this.code = init.code;
		this.details = init.details;
		this.requestId = init.requestId;
		this.retryAfter = init.retryAfter;
	}
}

export type Result<T> = { data: T; error?: undefined } | { data?: undefined; error: CorvoApiError };
