import type { Result } from "../error";
import { type HttpTransport, type Query, mapPlain } from "../transport";
import type { Paginated } from "../types/common";
import type { Company, CompanyCreateParams, CompanyUpdateParams } from "../types/company";

export interface CompanyListParams {
	limit?: number;
	cursor?: string;
}

function listQuery(params: CompanyListParams): Query {
	return { limit: params.limit, cursor: params.cursor };
}

export class CompaniesResource {
	constructor(private readonly http: HttpTransport) {}

	create(params: CompanyCreateParams): Promise<Result<Company>> {
		return this.http.request<Company>({ method: "POST", path: "/companies", body: params });
	}

	list(params: CompanyListParams = {}): Promise<Result<Paginated<Company>>> {
		return this.http.list<Company>("/companies", listQuery(params), mapPlain);
	}

	iterate(params: CompanyListParams = {}): AsyncGenerator<Company, void, undefined> {
		return this.http.iterate<Company>("/companies", listQuery(params), mapPlain);
	}

	get(id: string): Promise<Result<Company>> {
		return this.http.request<Company>({
			method: "GET",
			path: `/companies/${encodeURIComponent(id)}`,
		});
	}

	update(id: string, params: CompanyUpdateParams): Promise<Result<Company>> {
		return this.http.request<Company>({
			method: "PATCH",
			path: `/companies/${encodeURIComponent(id)}`,
			body: params,
		});
	}

	remove(id: string): Promise<Result<null>> {
		return this.http.request<null>({
			method: "DELETE",
			path: `/companies/${encodeURIComponent(id)}`,
		});
	}
}
