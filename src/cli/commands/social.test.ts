import { describe, expect, test } from "bun:test";
import { TEST_SESSION, createMemorySessionStore, runProgram } from "../test-helpers.ts";

describe("beli social", () => {
	describe("feed", () => {
		test("requires auth", async () => {
			const result = await runProgram(["social", "feed"]);
			expect(result.exitCode).toBe(3);
		});

		test("shows feed items", async () => {
			const store = createMemorySessionStore(TEST_SESSION);
			const result = await runProgram(["social", "feed"], { store });
			expect(result.exitCode).toBe(0);
			expect(result.stdout.length).toBeGreaterThan(0);
		});

		test("--json returns paginated JSON", async () => {
			const store = createMemorySessionStore(TEST_SESSION);
			const result = await runProgram(["--json", "social", "feed"], { store });
			expect(result.exitCode).toBe(0);
			const data = JSON.parse(result.stdout);
			expect(data.items).toBeInstanceOf(Array);
			expect(data.items.length).toBeGreaterThan(0);
			expect(data).toHaveProperty("nextCursor");
			expect(data.items[0]).toHaveProperty("restaurantId");
			expect(data.items.some((item: { listId: string | null }) => item.listId === null)).toBe(true);
		});

		test("--limit restricts results", async () => {
			const store = createMemorySessionStore(TEST_SESSION);
			const result = await runProgram(["--json", "social", "feed", "--limit", "2"], {
				store,
			});
			expect(result.exitCode).toBe(0);
			const data = JSON.parse(result.stdout);
			expect(data.items.length).toBeLessThanOrEqual(2);
		});
	});

	describe("followers", () => {
		test("requires auth", async () => {
			const result = await runProgram(["social", "followers"]);
			expect(result.exitCode).toBe(3);
		});

		test("shows followers", async () => {
			const store = createMemorySessionStore(TEST_SESSION);
			const result = await runProgram(["social", "followers"], { store });
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("user_");
		});

		test("--json returns paginated user list", async () => {
			const store = createMemorySessionStore(TEST_SESSION);
			const result = await runProgram(["--json", "social", "followers"], { store });
			expect(result.exitCode).toBe(0);
			const data = JSON.parse(result.stdout);
			expect(data.items).toBeInstanceOf(Array);
			// Should not include "me" (user_001)
			for (const user of data.items) {
				expect(user.id).not.toBe("user_001");
			}
			expect(data.items.some((user: { avatarUrl: string | null }) => user.avatarUrl === null)).toBe(
				true,
			);
		});
	});

	describe("following", () => {
		test("requires auth", async () => {
			const result = await runProgram(["social", "following"]);
			expect(result.exitCode).toBe(3);
		});

		test("--json returns paginated user list", async () => {
			const store = createMemorySessionStore(TEST_SESSION);
			const result = await runProgram(["--json", "social", "following"], { store });
			expect(result.exitCode).toBe(0);
			const data = JSON.parse(result.stdout);
			expect(data.items).toBeInstanceOf(Array);
			for (const user of data.items) {
				expect(user.id).not.toBe("user_001");
			}
		});
	});
});
