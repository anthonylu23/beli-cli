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

	test.each([
		["create", ["lists", "create", "--name", "New List"]],
		["update", ["lists", "update", "list_001", "--name", "Updated"]],
		["delete", ["lists", "delete", "list_001", "--yes"]],
		["add-entry", ["lists", "add-entry", "list_001", "--restaurant", "rest_002"]],
		["remove-entry", ["lists", "remove-entry", "list_001", "--restaurant", "rest_001"]],
	])("%s requires auth", async (_name, args) => {
		const result = await runProgram(args);
		expect(result.exitCode).toBe(3);
	});

	test("create --json creates a list from flags", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(
			[
				"--json",
				"lists",
				"create",
				"--name",
				"Weekend Ideas",
				"--description",
				"Try soon",
				"--visibility",
				"public",
			],
			{ store },
		);
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.name).toBe("Weekend Ideas");
		expect(data.description).toBe("Try soon");
		expect(data.visibility).toBe("public");
		expect(data.entries).toEqual([]);
	});

	test("create supports --input - JSON", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "--input", "-", "lists", "create"], {
			store,
			programOptions: {
				lists: {
					readJsonInput: async () => ({
						name: "From JSON",
						description: "Piped payload",
						visibility: "public",
					}),
				},
			},
		});
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.name).toBe("From JSON");
		expect(data.description).toBe("Piped payload");
		expect(data.visibility).toBe("public");
	});

	test("flags take precedence over --input - JSON", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(
			["--json", "--input", "-", "lists", "create", "--name", "Flag Name"],
			{
				store,
				programOptions: {
					lists: {
						readJsonInput: async () => ({
							name: "JSON Name",
							visibility: "public",
						}),
					},
				},
			},
		);
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.name).toBe("Flag Name");
		expect(data.visibility).toBe("public");
	});

	test("create rejects missing name and invalid visibility", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const missing = await runProgram(["lists", "create"], { store });
		expect(missing.exitCode).toBe(2);
		expect(missing.stderr).toContain("name is required");

		const invalid = await runProgram(
			["lists", "create", "--name", "Bad", "--visibility", "friends"],
			{ store },
		);
		expect(invalid.exitCode).toBe(2);
		expect(invalid.stderr).toContain("visibility must be public or private");
	});

	test("update changes a list from flags", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(
			["--json", "lists", "update", "list_001", "--name", "Updated", "--description", ""],
			{ store },
		);
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.id).toBe("list_001");
		expect(data.name).toBe("Updated");
		expect(data.description).toBeNull();
	});

	test("update supports --input - JSON and rejects unknown list", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const updated = await runProgram(["--json", "--input", "-", "lists", "update", "list_001"], {
			store,
			programOptions: {
				lists: {
					readJsonInput: async () => ({ visibility: "private" }),
				},
			},
		});
		expect(updated.exitCode).toBe(0);
		expect(JSON.parse(updated.stdout).visibility).toBe("private");

		const unknown = await runProgram(["lists", "update", "unknown", "--name", "Missing"], {
			store,
		});
		expect(unknown.exitCode).toBe(4);
	});

	test("delete --yes deletes a list with JSON confirmation payload", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "lists", "delete", "list_001", "--yes"], {
			store,
		});
		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.stdout)).toEqual({ deleted: true, id: "list_001" });
	});

	test("delete aborts when confirmation is declined", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["lists", "delete", "list_001"], {
			store,
			programOptions: {
				lists: {
					confirm: async () => false,
				},
			},
		});
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("Aborted.");
	});

	test("delete exits 4 for unknown list", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["lists", "delete", "unknown", "--yes"], { store });
		expect(result.exitCode).toBe(4);
	});

	test("add-entry adds a restaurant and supports --input - JSON", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "--input", "-", "lists", "add-entry", "list_001"], {
			store,
			programOptions: {
				lists: {
					readJsonInput: async () => ({
						restaurantId: "rest_002",
						notes: "Try brunch",
					}),
				},
			},
		});
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.entryCount).toBe(2);
		expect(data.entries.at(-1)).toMatchObject({
			restaurantId: "rest_002",
			notes: "Try brunch",
		});
	});

	test("add-entry flags take precedence over --input - JSON", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(
			["--json", "--input", "-", "lists", "add-entry", "list_001", "--restaurant", "rest_003"],
			{
				store,
				programOptions: {
					lists: {
						readJsonInput: async () => ({
							restaurantId: "rest_002",
						}),
					},
				},
			},
		);
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.entries.at(-1).restaurantId).toBe("rest_003");
	});

	test("add-entry rejects unknown restaurant", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["lists", "add-entry", "list_001", "--restaurant", "unknown"], {
			store,
		});
		expect(result.exitCode).toBe(4);
	});

	test("remove-entry removes a restaurant from a list", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(
			["--json", "lists", "remove-entry", "list_001", "--restaurant", "rest_001"],
			{ store },
		);
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.entryCount).toBe(0);
		expect(data.entries).toEqual([]);
	});

	test("remove-entry rejects unknown restaurant", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(
			["lists", "remove-entry", "list_001", "--restaurant", "unknown"],
			{ store },
		);
		expect(result.exitCode).toBe(4);
	});
});
