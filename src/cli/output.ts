import type { CorvoApiError } from "../error";
import type { Paginated } from "../types/common";

export function formatTable(rows: Array<Record<string, unknown>>): string {
	if (rows.length === 0) return "(no results)";
	const columns = Object.keys(rows[0]);
	const widths = columns.map((col) =>
		Math.max(col.length, ...rows.map((row) => String(row[col] ?? "").length)),
	);
	const line = (cells: string[]) => cells.map((cell, i) => cell.padEnd(widths[i])).join("  ");
	const header = line(columns).trimEnd();
	const divider = line(widths.map((w) => "-".repeat(w)));
	const body = rows.map((row) => line(columns.map((col) => String(row[col] ?? ""))).trimEnd());
	return [header, divider, ...body].join("\n");
}

export function printJson(value: unknown): void {
	process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printPage<T>(
	page: Paginated<T>,
	toRow: (item: T) => Record<string, unknown>,
): void {
	process.stdout.write(`${formatTable(page.data.map(toRow))}\n`);
	if (page.pagination.hasMore) {
		process.stdout.write(`More pages available — next cursor: ${page.pagination.nextCursor}\n`);
	}
}

export function formatError(error: CorvoApiError): string {
	const lines = [`${error.code}: ${error.message} (HTTP ${error.status || "no response"})`];
	if (error.requestId) lines.push(`requestId: ${error.requestId}`);
	for (const detail of error.details ?? []) {
		lines.push(`  ${detail.field} — ${detail.code}: ${detail.message}`);
	}
	if (error.retryAfter !== undefined) lines.push(`retryAfter: ${error.retryAfter}s`);
	return lines.join("\n");
}

export function fail(error: CorvoApiError, json: boolean): never {
	if (json) {
		process.stderr.write(
			`${JSON.stringify(
				{
					code: error.code,
					status: error.status,
					message: error.message,
					requestId: error.requestId,
					details: error.details,
					retryAfter: error.retryAfter,
				},
				null,
				2,
			)}\n`,
		);
	} else {
		process.stderr.write(`Error: ${formatError(error)}\n`);
	}
	process.exit(1);
}

export function failFatal(message: string): never {
	process.stderr.write(`Error: ${message}\n`);
	process.exit(1);
}

export async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString("utf8");
}
