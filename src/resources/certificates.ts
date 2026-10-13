import type { Result } from "../error";
import { type HttpTransport, type Query, mapPlain } from "../transport";
import type { Certificate, CertificateUploadParams } from "../types/certificate";
import type { Paginated } from "../types/common";

export interface CertificateListParams {
	limit?: number;
	cursor?: string;
}

export class CertificatesResource {
	constructor(private readonly http: HttpTransport) {}

	async upload(companyId: string, params: CertificateUploadParams): Promise<Result<Certificate>> {
		const form = new FormData();
		form.append(
			"file",
			new Blob([params.file], { type: "application/x-pkcs12" }),
			params.fileName ?? "certificate.p12",
		);
		form.append("password", params.password);
		return this.http.request<Certificate>({
			method: "POST",
			path: `/companies/${encodeURIComponent(companyId)}/certificates`,
			body: form,
		});
	}

	list(
		companyId: string,
		params: CertificateListParams = {},
	): Promise<Result<Paginated<Certificate>>> {
		const query: Query = { limit: params.limit, cursor: params.cursor };
		return this.http.list<Certificate>(
			`/companies/${encodeURIComponent(companyId)}/certificates`,
			query,
			mapPlain,
		);
	}

	remove(companyId: string, certId: string): Promise<Result<null>> {
		return this.http.request<null>({
			method: "DELETE",
			path: `/companies/${encodeURIComponent(companyId)}/certificates/${encodeURIComponent(certId)}`,
		});
	}
}
