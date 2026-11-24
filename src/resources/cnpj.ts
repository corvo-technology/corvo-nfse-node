import type { Result } from "../error";
import type { HttpTransport } from "../transport";
import type { CnpjProfile } from "../types/customer";

export class CnpjResource {
	constructor(private readonly http: HttpTransport) {}

	/** Look up the registration data of a CNPJ (`GET /cnpj/{cnpj}`, digits only). */
	lookup(cnpj: string): Promise<Result<CnpjProfile>> {
		return this.http.request<CnpjProfile>({
			method: "GET",
			path: `/cnpj/${encodeURIComponent(cnpj)}`,
		});
	}
}
