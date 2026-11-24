import type { Result } from "../error";
import type { DownloadedFile, HttpTransport } from "../transport";
import type { InvoicePackageSummary } from "../types/invoice";

export interface InvoicePackageDownloadParams {
	/** Competence month, `YYYY-MM`. */
	month: string;
	/** Parts to include. Default: both. */
	include?: Array<"xml" | "pdf">;
}

/** Monthly ZIP of authorized and cancelled notes (`/companies/{companyId}/invoice-package`). */
export class InvoicePackageResource {
	constructor(private readonly http: HttpTransport) {}

	/** Count and total of the month package, without building it. */
	summary(companyId: string, month: string): Promise<Result<InvoicePackageSummary>> {
		return this.http.request<InvoicePackageSummary>({
			method: "GET",
			path: `/companies/${encodeURIComponent(companyId)}/invoice-package/summary`,
			query: { month },
		});
	}

	/**
	 * Download the month package: a ZIP with `xml/`, `pdf/` and `resumo.csv` (the last file; a ZIP
	 * without it is incomplete). At most 500 notes (`422` `PACKAGE_TOO_LARGE` above that) and
	 * 10 packages per hour per workspace.
	 */
	download(
		companyId: string,
		params: InvoicePackageDownloadParams,
	): Promise<Result<DownloadedFile>> {
		return this.http.requestRaw({
			method: "GET",
			path: `/companies/${encodeURIComponent(companyId)}/invoice-package`,
			query: { month: params.month, include: params.include?.join(",") },
		});
	}
}
