import type {
	ImportJob as ImportJobSchema,
	ImportRow as ImportRowSchema,
	ImportStart,
	UpdateImportRow,
} from "./openapi";

/** Snake_case on purpose: imports answer in snake_case. */
export type ImportJob = ImportJobSchema;
export type ImportRow = ImportRowSchema;
export type ImportStarted = ImportStart;
/** The emit call has no documented body; `sendEmail` is only forwarded when you set it. */
export interface ImportEmitParams {
	sendEmail?: boolean;
}
export type ImportRowUpdateParams = UpdateImportRow;

export interface ImportStartParams {
	/** A `.csv` or `.xlsx` file, up to 2,000 rows and 10 MB. */
	file: Buffer | Uint8Array;
	/** Defaults to `import.csv`. Use the right extension (`.csv` or `.xlsx`). */
	fileName?: string;
	/** Company that issues every row without a CNPJ column value. */
	companyId?: string;
}

export interface ImportRowListParams {
	status?: ImportRowSchema["status"];
	/** Opaque. */
	cursor?: string;
	/** 1 to 200 (default 50). */
	limit?: number;
}
