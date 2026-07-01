import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { addPaginationOptions, extractPagination } from "./pagination.ts";

describe("addPaginationOptions", () => {
	test("adds --cursor and --limit options", () => {
		const cmd = addPaginationOptions(new Command("test"));
		const help = cmd.helpInformation();
		expect(help).toContain("--cursor");
		expect(help).toContain("--limit");
	});
});

describe("extractPagination", () => {
	test("returns undefined for missing options", () => {
		const result = extractPagination({});
		expect(result.cursor).toBeUndefined();
		expect(result.limit).toBeUndefined();
	});

	test("extracts cursor string", () => {
		const result = extractPagination({ cursor: "abc123" });
		expect(result.cursor).toBe("abc123");
	});

	test("extracts strict positive integer limit", () => {
		const result = extractPagination({ limit: "10" });
		expect(result.limit).toBe(10);
	});

	test("ignores non-string cursor", () => {
		const result = extractPagination({ cursor: 42 });
		expect(result.cursor).toBeUndefined();
	});

	test("ignores non-number limit", () => {
		const result = extractPagination({ limit: 10 });
		expect(result.limit).toBeUndefined();
	});
});

describe("--limit parser", () => {
	test("rejects non-positive integers", () => {
		const cmd = addPaginationOptions(new Command("test").exitOverride());
		cmd.parse(["node", "test", "--limit", "0"]);
		expect(() => extractPagination(cmd.opts())).toThrow(ValidationError);

		cmd.parse(["node", "test", "--limit", "-1"]);
		expect(() => extractPagination(cmd.opts())).toThrow(ValidationError);

		cmd.parse(["node", "test", "--limit", "abc"]);
		expect(() => extractPagination(cmd.opts())).toThrow(ValidationError);

		cmd.parse(["node", "test", "--limit", "1.5"]);
		expect(() => extractPagination(cmd.opts())).toThrow(ValidationError);

		cmd.parse(["node", "test", "--limit", "9007199254740992"]);
		expect(() => extractPagination(cmd.opts())).toThrow(ValidationError);
	});

	test("accepts positive integer", () => {
		const cmd = addPaginationOptions(new Command("test").exitOverride());
		cmd.parse(["node", "test", "--limit", "5"]);
		expect(extractPagination(cmd.opts()).limit).toBe(5);
	});
});
import { ValidationError } from "@core/errors.ts";
