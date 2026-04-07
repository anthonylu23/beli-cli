import { BeliError } from "@core/errors.ts";
import type { RunContext } from "./context.ts";

/** Column definition for table output. */
export interface Column {
	readonly key: string;
	readonly label: string;
	/** Minimum width for human-readable output. Defaults to label length. */
	readonly minWidth?: number;
}

// ── Field filtering ──────────────────────────────────────────────────

/** Filter an object to only include the specified fields. Returns the original if fields is empty. */
function pickFields<T extends Record<string, unknown>>(
	data: T,
	fields: readonly string[],
): Partial<T> {
	if (fields.length === 0) return data;
	const result: Record<string, unknown> = {};
	for (const field of fields) {
		if (field in data) {
			result[field] = data[field];
		}
	}
	return result as Partial<T>;
}

// ── JSON output ──────────────────────────────────────────────────────

/** Write a JSON value to stdout. */
export function printJson(data: unknown): void {
	process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

// ── Table output ─────────────────────────────────────────────────────

/** Print rows as a table (human) or JSON array (--json). */
export function printTable(
	rows: readonly Record<string, unknown>[],
	columns: readonly Column[],
	ctx: RunContext,
): void {
	const activeCols =
		ctx.fields.length > 0 ? columns.filter((c) => ctx.fields.includes(c.key)) : columns;

	if (ctx.json) {
		const filtered = rows.map((row) => pickFields(row, ctx.fields));
		printJson(filtered);
		return;
	}

	if (activeCols.length === 0 || rows.length === 0) {
		return;
	}

	// Compute column widths
	const widths = activeCols.map((col) => {
		const min = col.minWidth ?? col.label.length;
		let max = min;
		for (const row of rows) {
			const len = String(row[col.key] ?? "").length;
			if (len > max) max = len;
		}
		return max;
	});

	// Header
	const header = activeCols.map((col, i) => col.label.padEnd(widths[i] ?? 0)).join("  ");
	process.stdout.write(`${header}\n`);

	// Separator
	const sep = widths.map((w) => "─".repeat(w)).join("  ");
	process.stdout.write(`${sep}\n`);

	// Rows
	for (const row of rows) {
		const line = activeCols
			.map((col, i) => String(row[col.key] ?? "").padEnd(widths[i] ?? 0))
			.join("  ");
		process.stdout.write(`${line}\n`);
	}
}

// ── Detail output ────────────────────────────────────────────────────

/** Print a single entity detail view (human) or JSON object (--json). */
export function printDetail(data: Record<string, unknown>, ctx: RunContext): void {
	const filtered = pickFields(data, ctx.fields);

	if (ctx.json) {
		printJson(filtered);
		return;
	}

	const entries = Object.entries(filtered);
	if (entries.length === 0) return;

	const maxKeyLen = Math.max(...entries.map(([k]) => k.length));

	for (const [key, value] of entries) {
		const label = key.padEnd(maxKeyLen);
		process.stdout.write(`${label}  ${formatValue(value)}\n`);
	}
}

/** Format a value for human-readable detail output. */
function formatValue(value: unknown): string {
	if (value === null || value === undefined) return "—";
	if (Array.isArray(value)) return value.join(", ");
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

// ── Error output ─────────────────────────────────────────────────────

/** Print an error to stderr. Uses JSON when the context indicates --json mode. */
export function printError(error: unknown, ctx?: RunContext): void {
	if (error instanceof BeliError) {
		if (ctx?.json) {
			const payload: Record<string, unknown> = {
				error: error.kind,
				message: error.message,
			};
			process.stderr.write(`${JSON.stringify(payload)}\n`);
		} else {
			process.stderr.write(`error: ${error.message}\n`);
		}
		return;
	}

	const message = error instanceof Error ? error.message : "An unexpected error occurred";

	if (ctx?.json) {
		process.stderr.write(`${JSON.stringify({ error: "unknown", message })}\n`);
	} else {
		process.stderr.write(`error: ${message}\n`);
	}
}
