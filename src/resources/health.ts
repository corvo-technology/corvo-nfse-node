import type { Result } from "../error";
import type { HttpTransport } from "../transport";
import type { Health } from "../types/openapi";

export class HealthResource {
	constructor(private readonly http: HttpTransport) {}

	/** Liveness: answers 200 while the API process is up. Needs no API key. */
	live(): Promise<Result<Health>> {
		return this.http.request<Health>({ method: "GET", path: "/health/live", unwrap: "none" });
	}

	ready(): Promise<Result<unknown>> {
		return this.http.request({ method: "GET", path: "/health/ready", unwrap: "none" });
	}
}
