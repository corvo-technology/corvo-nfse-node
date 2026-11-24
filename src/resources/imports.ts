import type { Result } from "../error";
import { type DownloadedFile, type HttpTransport, type Query, mapPlain } from "../transport";
import type { Paginated } from "../types/common";
import type {
	ImportEmitParams,
	ImportJob,
	ImportRow,
	ImportRowListParams,
	ImportRowUpdateParams,
	ImportStartParams,
	ImportStarted,
} from "../types/import";

function rowsQuery(params: ImportRowListParams): Query {
	return { status: params.status, cursor: params.cursor, limit: params.limit };
}

/** Spreadsheet imports (`/imports`). Fields are snake_case. */
export class ImportsResource {
	constructor(private readonly http: HttpTransport) {}

	/**
	 * Import invoices from a `.csv` or `.xlsx` file (`POST /imports`, multipart). Reading is
	 * asynchronous: follow the import with `get` until it is `ready`.
	 */
	start(params: ImportStartParams): Promise<Result<ImportStarted>> {
		const form = new FormData();
		form.append("file", new Blob([params.file]), params.fileName ?? "import.csv");
		if (params.companyId !== undefined) form.append("companyId", params.companyId);
		return this.http.request<ImportStarted>({ method: "POST", path: "/imports", body: form });
	}

	/** Recent imports with their counters (newest first, at most 20). */
	list(params: { limit?: number } = {}): Promise<Result<ImportJob[]>> {
		return this.http.request<ImportJob[]>({
			method: "GET",
			path: "/imports",
			query: { limit: params.limit },
		});
	}

	get(id: string): Promise<Result<ImportJob>> {
		return this.http.request<ImportJob>({
			method: "GET",
			path: `/imports/${encodeURIComponent(id)}`,
		});
	}

	/** Emit every valid row. Safe to call twice. */
	emit(id: string, params?: ImportEmitParams): Promise<Result<ImportJob>> {
		return this.http.request<ImportJob>({
			method: "POST",
			path: `/imports/${encodeURIComponent(id)}/emit`,
			body: params && Object.keys(params).length > 0 ? params : undefined,
		});
	}

	/** Rows of an import, one page at a time (default 50, at most 200). */
	listRows(id: string, params: ImportRowListParams = {}): Promise<Result<Paginated<ImportRow>>> {
		return this.http.list<ImportRow>(
			`/imports/${encodeURIComponent(id)}/rows`,
			rowsQuery(params),
			mapPlain,
		);
	}

	iterateRows(
		id: string,
		params: ImportRowListParams = {},
	): AsyncGenerator<ImportRow, void, undefined> {
		return this.http.iterate<ImportRow>(
			`/imports/${encodeURIComponent(id)}/rows`,
			rowsQuery(params),
			mapPlain,
		);
	}

	/** Correct one row and check it again (only while the import is `ready`). */
	updateRow(id: string, line: number, params: ImportRowUpdateParams): Promise<Result<ImportRow>> {
		return this.http.request<ImportRow>({
			method: "PATCH",
			path: `/imports/${encodeURIComponent(id)}/rows/${line}`,
			body: params,
		});
	}

	/** Discard an import that has not been emitted. */
	discard(id: string): Promise<Result<null>> {
		return this.http.request<null>({
			method: "DELETE",
			path: `/imports/${encodeURIComponent(id)}`,
		});
	}

	/** The spreadsheet template (CSV). */
	downloadTemplate(): Promise<Result<DownloadedFile>> {
		return this.http.requestRaw({ method: "GET", path: "/imports/template" });
	}

	/** CSV with the rows that need attention and the reason. */
	downloadErrors(id: string): Promise<Result<DownloadedFile>> {
		return this.http.requestRaw({
			method: "GET",
			path: `/imports/${encodeURIComponent(id)}/errors.csv`,
		});
	}
}
