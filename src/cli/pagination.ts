import type { PaginationOptions } from "@adapters/private-mobile/contract.ts";
import { ValidationError } from "@core/errors.ts";
import type { Command } from "commander";

/** Add --cursor and --limit options to a command. */
export function addPaginationOptions(cmd: Command): Command {
	return cmd
		.option("--cursor <cursor>", "Pagination cursor for next page")
		.option("--limit <n>", "Maximum number of items to return");
}

/** Extract PaginationOptions from parsed command options. */
export function extractPagination(opts: Record<string, unknown>): PaginationOptions {
	return {
		cursor: typeof opts.cursor === "string" ? opts.cursor : undefined,
		limit: typeof opts.limit === "string" ? parseLimit(opts.limit) : undefined,
	};
}

function parseLimit(value: string): number {
	if (!/^[1-9]\d*$/.test(value)) {
		throw new ValidationError("--limit must be a positive integer", "limit");
	}
	return Number(value);
}
