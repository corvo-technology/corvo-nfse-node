import type { Result } from "../error";
import type { HttpTransport } from "../transport";
import type { ServiceFavorite, ServiceFavoriteCreateParams } from "../types/company";

/** Favorite services of a company (`/companies/{companyId}/service-favorites`). */
export class ServiceFavoritesResource {
	constructor(private readonly http: HttpTransport) {}

	list(companyId: string): Promise<Result<ServiceFavorite[]>> {
		return this.http.request<ServiceFavorite[]>({
			method: "GET",
			path: `/companies/${encodeURIComponent(companyId)}/service-favorites`,
		});
	}

	create(companyId: string, params: ServiceFavoriteCreateParams): Promise<Result<ServiceFavorite>> {
		return this.http.request<ServiceFavorite>({
			method: "POST",
			path: `/companies/${encodeURIComponent(companyId)}/service-favorites`,
			body: params,
		});
	}

	remove(companyId: string, favoriteId: string): Promise<Result<{ deleted: true }>> {
		return this.http.request<{ deleted: true }>({
			method: "DELETE",
			path: `/companies/${encodeURIComponent(companyId)}/service-favorites/${encodeURIComponent(favoriteId)}`,
		});
	}
}
