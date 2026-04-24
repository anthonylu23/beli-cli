import { describe, expect, test } from "bun:test";
import { TEST_SESSION, createMemorySessionStore, runProgram } from "../test-helpers.ts";

describe("beli me", () => {
	test("profile requires auth", async () => {
		const result = await runProgram(["me", "profile"]);
		expect(result.exitCode).toBe(3);
		expect(result.stderr).toContain("beli auth bootstrap");
	});

	test("profile shows user details", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["me", "profile"], { store });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("user_001");
	});

	test("profile --json outputs JSON", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "me", "profile"], { store });
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.id).toBe("user_001");
		expect(data.username).toBeDefined();
		expect(typeof data.stats.totalRatings).toBe("number");
		expect(data.createdAt).toBe("2023-06-15T08:00:00.000Z");
	});

	test("stats shows user stats", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["me", "stats"], { store });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("totalRatings");
	});

	test("stats --json outputs JSON", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "me", "stats"], { store });
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(typeof data.totalRatings).toBe("number");
		expect(typeof data.followerCount).toBe("number");
	});

	test("stats --fields filters output", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "--fields", "totalRatings", "me", "stats"], {
			store,
		});
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.totalRatings).toBeDefined();
		expect(data.followerCount).toBeUndefined();
	});
});
