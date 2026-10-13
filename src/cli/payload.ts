import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { failFatal, readStdin } from "./output";

export async function readPayload(file: string | undefined): Promise<Record<string, unknown>> {
	if (!file) failFatal("Missing --file <path> (use - to read JSON from stdin)");
	const raw = file === "-" ? await readStdin() : readFileSync(resolve(file), "utf8");
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
			failFatal("Payload must be a JSON object");
		}
		return parsed as Record<string, unknown>;
	} catch (error) {
		failFatal(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
	}
}
