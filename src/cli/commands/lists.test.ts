import { describe, expect, test } from "bun:test";
import { TEST_SESSION, createMemorySessionStore, runProgram } from "../test-helpers.ts";

describe("beli lists", () => {
	test("ls requires auth", async () => {
		const result = await runProgram(["lists", "ls"]);
		expect(result.exitCode).toBe(3);
	});

	test("ls shows lists", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["lists", "ls"], { store });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("list_");
	});

	test("ls --json returns paginated JSON", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "lists", "ls"], { store });
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.items).toBeInstanceOf(Array);
		expect(data).toHaveProperty("nextCursor");
		expect(data.items[0].entries).toBeInstanceOf(Array);
	});

	test("ls --limit 1 returns one item with cursor", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "lists", "ls", "--limit", "1"], { store });
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.items).toHaveLength(1);
		expect(data.nextCursor).not.toBeNull();
	});

	test("get requires auth", async () => {
		const result = await runProgram(["lists", "get", "list_001"]);
		expect(result.exitCode).toBe(3);
	});

	test("get shows list detail", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "lists", "get", "list_001"], { store });
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.id).toBe("list_001");
		expect(data.name).toBeDefined();
		expect(data.entries).toBeInstanceOf(Array);
	});

	test("get --json preserves null fields", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "lists", "get", "list_002"], { store });
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.description).toBeNull();
		expect(data.entries[0].notes).toBeNull();
	});

	test("get exits 4 for unknown list", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["lists", "get", "unknown"], { store });
		expect(result.exitCode).toBe(4);
	});
});
