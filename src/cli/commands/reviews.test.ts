import { describe, expect, test } from "bun:test";
import { TEST_SESSION, createMemorySessionStore, runProgram } from "../test-helpers.ts";

describe("beli reviews", () => {
	test.each([
		["create", ["reviews", "create", "--restaurant", "rest_001", "--body", "Great"]],
		["update", ["reviews", "update", "rev_001", "--body", "Updated"]],
		["delete", ["reviews", "delete", "rev_001", "--yes"]],
	])("%s requires auth", async (_name, args) => {
		const result = await runProgram(args);
		expect(result.exitCode).toBe(3);
	});

	test("create --json creates a review from flags", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(
			[
				"--json",
				"reviews",
				"create",
				"--restaurant",
				"rest_001",
				"--body",
				"Great slice",
				"--rating",
				"rate_001",
				"--image-urls",
				"https://example.com/one.jpg,https://example.com/two.jpg",
			],
			{ store },
		);
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.id).toBe("rev_003");
		expect(data.restaurantId).toBe("rest_001");
		expect(data.ratingId).toBe("rate_001");
		expect(data.body).toBe("Great slice");
		expect(data.imageUrls).toEqual(["https://example.com/one.jpg", "https://example.com/two.jpg"]);
	});

	test("create supports --input - JSON", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "--input", "-", "reviews", "create"], {
			store,
			programOptions: {
				reviews: {
					readJsonInput: async () => ({
						restaurantId: "rest_002",
						body: "From JSON",
						imageUrls: ["https://example.com/json.jpg"],
					}),
				},
			},
		});
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.restaurantId).toBe("rest_002");
		expect(data.ratingId).toBeNull();
		expect(data.body).toBe("From JSON");
		expect(data.imageUrls).toEqual(["https://example.com/json.jpg"]);
	});

	test("flags take precedence over --input - JSON", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(
			[
				"--json",
				"--input",
				"-",
				"reviews",
				"create",
				"--restaurant",
				"rest_001",
				"--body",
				"Flag body",
			],
			{
				store,
				programOptions: {
					reviews: {
						readJsonInput: async () => ({
							restaurantId: "rest_002",
							body: "JSON body",
						}),
					},
				},
			},
		);
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.restaurantId).toBe("rest_001");
		expect(data.body).toBe("Flag body");
	});

	test("create rejects missing body, empty body, unknown restaurant, and unknown rating", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const missing = await runProgram(["reviews", "create", "--restaurant", "rest_001"], {
			store,
		});
		expect(missing.exitCode).toBe(2);
		expect(missing.stderr).toContain("body is required");

		const empty = await runProgram(
			["reviews", "create", "--restaurant", "rest_001", "--body", " "],
			{ store },
		);
		expect(empty.exitCode).toBe(2);
		expect(empty.stderr).toContain("Review body must be non-empty");

		const unknownRestaurant = await runProgram(
			["reviews", "create", "--restaurant", "unknown", "--body", "Missing"],
			{ store },
		);
		expect(unknownRestaurant.exitCode).toBe(4);

		const unknownRating = await runProgram(
			[
				"reviews",
				"create",
				"--restaurant",
				"rest_001",
				"--rating",
				"unknown",
				"--body",
				"Missing rating",
			],
			{ store },
		);
		expect(unknownRating.exitCode).toBe(4);
	});

	test("update changes a review from flags", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(
			[
				"--json",
				"reviews",
				"update",
				"rev_001",
				"--body",
				"Updated review",
				"--image-urls",
				"https://example.com/updated.jpg",
			],
			{ store },
		);
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.id).toBe("rev_001");
		expect(data.body).toBe("Updated review");
		expect(data.imageUrls).toEqual(["https://example.com/updated.jpg"]);
	});

	test("update supports --input - JSON and rejects unknown review", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const updated = await runProgram(["--json", "--input", "-", "reviews", "update", "rev_001"], {
			store,
			programOptions: {
				reviews: {
					readJsonInput: async () => ({ body: "JSON update" }),
				},
			},
		});
		expect(updated.exitCode).toBe(0);
		expect(JSON.parse(updated.stdout).body).toBe("JSON update");

		const unknown = await runProgram(["reviews", "update", "unknown", "--body", "Missing"], {
			store,
		});
		expect(unknown.exitCode).toBe(4);
	});

	test("update rejects empty payload", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["reviews", "update", "rev_001"], { store });
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("At least one review field must be provided");
	});

	test("delete --yes deletes a review with JSON confirmation payload", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "reviews", "delete", "rev_001", "--yes"], {
			store,
		});
		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.stdout)).toEqual({ deleted: true, id: "rev_001" });
	});

	test("delete aborts when confirmation is declined", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["reviews", "delete", "rev_001"], {
			store,
			programOptions: {
				reviews: {
					confirm: async () => false,
				},
			},
		});
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("Aborted.");
	});

	test("delete exits 4 for unknown review", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["reviews", "delete", "unknown", "--yes"], { store });
		expect(result.exitCode).toBe(4);
	});
});
