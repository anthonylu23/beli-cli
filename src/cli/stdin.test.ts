import { describe, expect, test } from "bun:test";
import { ValidationError } from "@core/errors.ts";

/**
 * Stdin tests are limited because we can't easily mock process.stdin in Bun.
 * We test the JSON parsing logic indirectly and verify error behavior
 * through integration-style tests using Bun subprocess.
 */
describe("readStdinJson", () => {
	test("parses valid JSON from piped stdin", async () => {
		const proc = Bun.spawn(
			[
				"bun",
				"-e",
				`
				import { readStdinJson } from "./src/cli/stdin.ts";
				const data = await readStdinJson();
				process.stdout.write(JSON.stringify(data));
				`,
			],
			{
				stdin: new TextEncoder().encode('{"name":"test","value":42}'),
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const output = await new Response(proc.stdout).text();
		expect(JSON.parse(output)).toEqual({ name: "test", value: 42 });
	});

	test("throws ValidationError on invalid JSON", async () => {
		const proc = Bun.spawn(
			[
				"bun",
				"-e",
				`
				import { readStdinJson } from "./src/cli/stdin.ts";
				try {
					await readStdinJson();
					process.exit(0);
				} catch (e) {
					process.stdout.write(e.constructor.name);
					process.exit(1);
				}
				`,
			],
			{
				stdin: new TextEncoder().encode("not valid json{{{"),
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const output = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;
		expect(exitCode).toBe(1);
		expect(output).toBe("ValidationError");
	});

	test("throws ValidationError on empty stdin", async () => {
		const proc = Bun.spawn(
			[
				"bun",
				"-e",
				`
				import { readStdinJson } from "./src/cli/stdin.ts";
				try {
					await readStdinJson();
					process.exit(0);
				} catch (e) {
					process.stdout.write(e.constructor.name);
					process.exit(1);
				}
				`,
			],
			{
				stdin: new TextEncoder().encode(""),
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const output = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;
		expect(exitCode).toBe(1);
		expect(output).toBe("ValidationError");
	});
});
