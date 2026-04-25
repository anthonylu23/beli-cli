import { describe, expect, test } from "bun:test";
import { TEST_SESSION, createMemorySessionStore, runProgram } from "../test-helpers.ts";

describe("beli ratings", () => {
	test.each([
		["create", ["ratings", "create", "--restaurant", "rest_001", "--score", "8"]],
		["update", ["ratings", "update", "rate_001", "--score", "6"]],
		["delete", ["ratings", "delete", "rate_001", "--yes"]],
	])("%s requires auth", async (_name, args) => {
		const result = await runProgram(args);
		expect(result.exitCode).toBe(3);
	});

	test("create --json creates a rating from flags", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(
			[
				"--json",
				"ratings",
				"create",
				"--restaurant",
				"rest_002",
				"--score",
				"8.5",
				"--favorite-dishes",
				"Morning bun,Croque monsieur",
				"--tags",
				"brunch,bakery",
			],
			{ store },
		);
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.id).toBe("rate_005");
		expect(data.restaurantId).toBe("rest_002");
		expect(data.score).toBe(8.5);
		expect(data.sentiment).toBe("positive");
		expect(data.favoriteDishes).toEqual(["Morning bun", "Croque monsieur"]);
		expect(data.tags).toEqual(["brunch", "bakery"]);
	});

	test("create supports --input - JSON", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "--input", "-", "ratings", "create"], {
			store,
			programOptions: {
				ratings: {
					readJsonInput: async () => ({
						restaurantId: "rest_003",
						score: 4,
						favoriteDishes: ["Tasting menu"],
					}),
				},
			},
		});
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.restaurantId).toBe("rest_003");
		expect(data.sentiment).toBe("neutral");
		expect(data.favoriteDishes).toEqual(["Tasting menu"]);
	});

	test("flags take precedence over --input - JSON", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(
			["--json", "--input", "-", "ratings", "create", "--restaurant", "rest_001", "--score", "9"],
			{
				store,
				programOptions: {
					ratings: {
						readJsonInput: async () => ({
							restaurantId: "rest_002",
							score: 2,
						}),
					},
				},
			},
		);
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.restaurantId).toBe("rest_001");
		expect(data.score).toBe(9);
		expect(data.sentiment).toBe("positive");
	});

	test("create rejects missing score, invalid score, and unknown restaurant", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const missing = await runProgram(["ratings", "create", "--restaurant", "rest_001"], {
			store,
		});
		expect(missing.exitCode).toBe(2);
		expect(missing.stderr).toContain("score is required");

		const invalid = await runProgram(
			["ratings", "create", "--restaurant", "rest_001", "--score", "11"],
			{ store },
		);
		expect(invalid.exitCode).toBe(2);
		expect(invalid.stderr).toContain("score must be a finite number from 0 to 10");

		const unknown = await runProgram(
			["ratings", "create", "--restaurant", "unknown", "--score", "8"],
			{ store },
		);
		expect(unknown.exitCode).toBe(4);
	});

	test("update changes a rating from flags", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(
			[
				"--json",
				"ratings",
				"update",
				"rate_001",
				"--score",
				"3",
				"--favorite-dishes",
				"Plain slice",
				"--tags",
				"changed",
			],
			{ store },
		);
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.id).toBe("rate_001");
		expect(data.score).toBe(3);
		expect(data.sentiment).toBe("negative");
		expect(data.favoriteDishes).toEqual(["Plain slice"]);
		expect(data.tags).toEqual(["changed"]);
	});

	test("update supports --input - JSON and rejects unknown rating", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const updated = await runProgram(["--json", "--input", "-", "ratings", "update", "rate_001"], {
			store,
			programOptions: {
				ratings: {
					readJsonInput: async () => ({ score: 6, tags: ["solid"] }),
				},
			},
		});
		expect(updated.exitCode).toBe(0);
		expect(JSON.parse(updated.stdout).sentiment).toBe("neutral");

		const unknown = await runProgram(["ratings", "update", "unknown", "--score", "8"], {
			store,
		});
		expect(unknown.exitCode).toBe(4);
	});

	test("update rejects empty payload", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["ratings", "update", "rate_001"], { store });
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("At least one rating field must be provided");
	});

	test("delete --yes deletes a rating with JSON confirmation payload", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "ratings", "delete", "rate_001", "--yes"], {
			store,
		});
		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.stdout)).toEqual({ deleted: true, id: "rate_001" });
	});

	test("delete aborts when confirmation is declined", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["ratings", "delete", "rate_001"], {
			store,
			programOptions: {
				ratings: {
					confirm: async () => false,
				},
			},
		});
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("Aborted.");
	});

	test("delete exits 4 for unknown rating", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["ratings", "delete", "unknown", "--yes"], { store });
		expect(result.exitCode).toBe(4);
	});
});
