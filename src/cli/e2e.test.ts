import { describe, expect, test } from "bun:test";
import { createStubAdapter } from "@adapters/private-mobile/stub.ts";
import { TEST_SESSION, createMemorySessionStore, runProgram } from "./test-helpers.ts";

interface CliResult {
	readonly exitCode: number;
	readonly stdout: string;
	readonly stderr: string;
}

async function runCli(args: readonly string[]): Promise<CliResult> {
	const proc = Bun.spawn(["bun", "src/cli/index.ts", ...args], {
		cwd: process.cwd(),
		stdout: "pipe",
		stderr: "pipe",
	});

	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);

	return { exitCode, stdout, stderr };
}

describe("CLI end-to-end", () => {
	test("shows help with global flags and raw subcommand", async () => {
		const result = await runCli(["--help"]);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout).toContain("Usage: beli");
		expect(result.stdout).toContain("--json");
		expect(result.stdout).toContain("--input <source>");
		expect(result.stdout).toContain("raw <resource>");
	});

	test("writes human-readable stderr and no stdout for unsupported raw command", async () => {
		const result = await runCli(["raw", "foo"]);

		expect(result.exitCode).toBe(5);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("error: The raw command requires --experimental.");
	});

	test("writes JSON stderr and no stdout in --json error mode", async () => {
		const result = await runCli(["--json", "raw", "foo"]);

		expect(result.exitCode).toBe(5);
		expect(result.stdout).toBe("");

		const parsed = JSON.parse(result.stderr);
		expect(parsed).toEqual({
			error: "unsupported",
			message: "The raw command requires --experimental. Usage: beli --experimental raw <resource>",
		});
	});

	test("renders structured human-readable raw placeholder output", async () => {
		const result = await runCli(["--experimental", "raw", "foo"]);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout).toContain("resource");
		expect(result.stdout).toContain("foo");
		expect(result.stdout).toContain("status");
		expect(result.stdout).toContain("recognized");
		expect(result.stdout).toContain("implemented");
		expect(result.stdout).toContain("false");
	});

	test("renders JSON raw placeholder output to stdout only", async () => {
		const result = await runCli(["--json", "--experimental", "raw", "foo"]);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(JSON.parse(result.stdout)).toEqual({
			resource: "foo",
			status: "recognized",
			implemented: false,
			message: "Adapter not yet implemented.",
		});
	});

	test("filters human-readable output with --fields", async () => {
		const result = await runCli(["--experimental", "--fields", "resource,status", "raw", "foo"]);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout).toContain("resource");
		expect(result.stdout).toContain("status");
		expect(result.stdout).not.toContain("implemented");
		expect(result.stdout).not.toContain("message");
	});

	test("filters JSON output with --fields", async () => {
		const result = await runCli([
			"--json",
			"--experimental",
			"--fields",
			"resource,status",
			"raw",
			"foo",
		]);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(JSON.parse(result.stdout)).toEqual({
			resource: "foo",
			status: "recognized",
		});
	});

	test("propagates file input sources into human-readable output", async () => {
		const result = await runCli(["--experimental", "--input", "sample.json", "raw", "foo"]);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout).toContain("inputSource");
		expect(result.stdout).toContain("sample.json");
	});

	test("propagates stdin sentinel input sources into JSON output without reading stdin", async () => {
		const result = await runCli(["--json", "--experimental", "--input", "-", "raw", "foo"]);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");

		const parsed = JSON.parse(result.stdout);
		expect(parsed.inputSource).toBe("-");
		expect(parsed.resource).toBe("foo");
	});

	test("composes authenticated writes with subsequent reads", async () => {
		const adapter = createStubAdapter();
		const store = createMemorySessionStore(TEST_SESSION);
		const created = await runProgram(["--json", "lists", "create", "--name", "Composed List"], {
			store,
			adapter: () => adapter,
		});
		expect(created.exitCode).toBe(0);
		const id = JSON.parse(created.stdout).id as string;

		const read = await runProgram(["--json", "lists", "get", id], {
			store,
			adapter: () => adapter,
		});
		expect(read.exitCode).toBe(0);
		expect(JSON.parse(read.stdout).name).toBe("Composed List");
	});

	test("routes stdin write payloads through the authenticated command stack", async () => {
		const result = await runProgram(["--json", "--input", "-", "ratings", "create"], {
			store: createMemorySessionStore(TEST_SESSION),
			programOptions: {
				ratings: {
					readJsonInput: async () => ({ restaurantId: "rest_001", score: 8.25 }),
				},
			},
		});
		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			restaurantId: "rest_001",
			score: 8.25,
		});
	});
});
