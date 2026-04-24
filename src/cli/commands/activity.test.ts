import { describe, expect, test } from "bun:test";
import { TEST_SESSION, createMemorySessionStore, runProgram } from "../test-helpers.ts";

describe("beli activity", () => {
	test("list requires auth", async () => {
		const result = await runProgram(["activity", "list"]);
		expect(result.exitCode).toBe(3);
	});

	test("list shows activity items", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["activity", "list"], { store });
		expect(result.exitCode).toBe(0);
		// Should have table output with feed items for user_001
		expect(result.stdout.length).toBeGreaterThan(0);
	});

	test("list --json returns paginated JSON", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "activity", "list"], { store });
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.items).toBeInstanceOf(Array);
		expect(data).toHaveProperty("nextCursor");
		// All items should belong to user_001 (from session)
		for (const item of data.items) {
			expect(item.userId).toBe("user_001");
		}
		expect(data.items.some((item: { reviewId: string | null }) => item.reviewId === null)).toBe(
			true,
		);
	});

	test("list --user filters by specific user", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "activity", "list", "--user", "user_002"], {
			store,
		});
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		for (const item of data.items) {
			expect(item.userId).toBe("user_002");
		}
	});

	test("list --limit restricts results", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "activity", "list", "--limit", "1"], { store });
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.items.length).toBeLessThanOrEqual(1);
	});
});
