import type { Result } from "../error";
import { type HttpTransport, type Query, mapPlain } from "../transport";
import type { Paginated } from "../types/common";
import type { Customer, CustomerSearchParams, CustomerUpdateParams } from "../types/customer";

function searchQuery(params: CustomerSearchParams): Query {
	return { search: params.search, limit: params.limit, cursor: params.cursor };
}

/** Customers saved from accepted invoices (`/customers`). `taxId` is the CPF or CNPJ, digits only. */
export class CustomersResource {
	constructor(private readonly http: HttpTransport) {}

	/** Most recently used first. */
	search(params: CustomerSearchParams = {}): Promise<Result<Paginated<Customer>>> {
		return this.http.list<Customer>("/customers", searchQuery(params), mapPlain);
	}

	iterate(params: CustomerSearchParams = {}): AsyncGenerator<Customer, void, undefined> {
		return this.http.iterate<Customer>("/customers", searchQuery(params), mapPlain);
	}

	get(taxId: string): Promise<Result<Customer>> {
		return this.http.request<Customer>({
			method: "GET",
			path: `/customers/${encodeURIComponent(taxId)}`,
		});
	}

	/** Correct the name or the e-mail (`null` clears it). */
	update(taxId: string, params: CustomerUpdateParams): Promise<Result<Customer>> {
		return this.http.request<Customer>({
			method: "PATCH",
			path: `/customers/${encodeURIComponent(taxId)}`,
			body: params,
		});
	}

	/** Forget a saved customer (issued invoices are not changed). */
	remove(taxId: string): Promise<Result<Record<string, unknown> | null>> {
		return this.http.request<Record<string, unknown> | null>({
			method: "DELETE",
			path: `/customers/${encodeURIComponent(taxId)}`,
		});
	}
}
