import { describe, expect, test } from "bun:test";
import { resolveContext } from "./flags.ts";

describe("resolveContext", () => {
	test("returns defaults when no options are set", () => {
		const ctx = resolveContext({});
		expect(ctx.json).toBe(false);
		expect(ctx.fields).toEqual([]);
		expect(ctx.yes).toBe(false);
		expect(ctx.profile).toBe("default");
		expect(ctx.experimental).toBe(false);
	});

	test("parses --json flag", () => {
		const ctx = resolveContext({ json: true });
		expect(ctx.json).toBe(true);
	});

	test("parses --fields into array", () => {
		const ctx = resolveContext({ fields: "name,score,id" });
		expect(ctx.fields).toEqual(["name", "score", "id"]);
	});

	test("trims whitespace and filters empty fields", () => {
		const ctx = resolveContext({ fields: " name , , score " });
		expect(ctx.fields).toEqual(["name", "score"]);
	});

	test("returns empty fields when not provided", () => {
		const ctx = resolveContext({});
		expect(ctx.fields).toEqual([]);
	});

	test("parses --no-color (Commander sets color=false)", () => {
		const ctx = resolveContext({ color: false });
		expect(ctx.noColor).toBe(true);
	});

	test("respects NO_COLOR env variable", () => {
		const original = process.env.NO_COLOR;
		try {
			process.env.NO_COLOR = "1";
			const ctx = resolveContext({ color: true });
			expect(ctx.noColor).toBe(true);
		} finally {
			if (original === undefined) {
				process.env.NO_COLOR = undefined;
			} else {
				process.env.NO_COLOR = original;
			}
		}
	});

	test("parses --yes flag", () => {
		const ctx = resolveContext({ yes: true });
		expect(ctx.yes).toBe(true);
	});

	test("parses --profile", () => {
		const ctx = resolveContext({ profile: "work" });
		expect(ctx.profile).toBe("work");
	});

	test("parses --experimental flag", () => {
		const ctx = resolveContext({ experimental: true });
		expect(ctx.experimental).toBe(true);
	});
});
