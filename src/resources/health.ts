import type { Result } from "../error";
import type { HttpTransport } from "../transport";

export class HealthResource {
	constructor(private readonly http: HttpTransport) {}

	live(): Promise<Result<unknown>> {
		return this.http.request({ method: "GET", path: "/health/live", unwrap: "none" });
	}

	ready(): Promise<Result<unknown>> {
		return this.http.request({ method: "GET", path: "/health/ready", unwrap: "none" });
	}
}
