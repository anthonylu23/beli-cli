import { describe, expect, test } from "bun:test";
import { createStubAdapter } from "@adapters/private-mobile/stub.ts";
import type { Session } from "@core/session.ts";
import { TEST_SESSION, createMemorySessionStore, runProgram } from "../test-helpers.ts";

describe("beli restaurants", () => {
	test("search requires auth", async () => {
		const result = await runProgram(["restaurants", "search", "pizza"]);
		expect(result.exitCode).toBe(3);
	});

	test("search returns matching restaurants", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["restaurants", "search", "pizza"], { store });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Pizza");
	});

	test("search --json returns paginated JSON", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "restaurants", "search", "pizza"], { store });
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.items).toBeInstanceOf(Array);
		expect(data).toHaveProperty("nextCursor");
		expect(data.items[0].cuisines).toBeInstanceOf(Array);
		expect(data.items[0].tags).toBeInstanceOf(Array);
		expect(typeof data.items[0].priceLevel).toBe("number");
		expect(data.items[0].location).toBeDefined();
	});

	test("search --limit restricts results", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "restaurants", "search", "a", "--limit", "1"], {
			store,
		});
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.items.length).toBeLessThanOrEqual(1);
	});

	test("get requires auth", async () => {
		const result = await runProgram(["restaurants", "get", "rest_001"]);
		expect(result.exitCode).toBe(3);
	});

	test("get shows restaurant detail", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["restaurants", "get", "rest_001"], { store });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("rest_001");
	});

	test("get --json outputs JSON detail", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "restaurants", "get", "rest_001"], { store });
		expect(result.exitCode).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.id).toBe("rest_001");
		expect(data.cuisines).toEqual(["Pizza", "Italian"]);
		expect(data.location.city).toBe("New York");
	});

	test("search rejects invalid limit before auth", async () => {
		const result = await runProgram(["restaurants", "search", "pizza", "--limit", "1.5"]);
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("--limit");
	});

	test("search rejects invalid latitude before auth", async () => {
		const result = await runProgram(["restaurants", "search", "pizza", "--lat", "abc"]);
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("--lat");
	});

	test("search rejects invalid longitude before auth", async () => {
		const result = await runProgram(["restaurants", "search", "pizza", "--lng", "1abc"]);
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("--lng");
	});

	test("search rejects out-of-range coordinates before auth", async () => {
		const latitude = await runProgram(["restaurants", "search", "pizza", "--lat", "90.1"]);
		expect(latitude.exitCode).toBe(2);
		const longitude = await runProgram(["restaurants", "search", "pizza", "--lng", "-180.1"]);
		expect(longitude.exitCode).toBe(2);
	});

	test("creates the adapter with the loaded session", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		let receivedSession: Session | null = null;

		const result = await runProgram(["--json", "restaurants", "get", "rest_001"], {
			store,
			adapter: (session) => {
				receivedSession = session;
				return createStubAdapter();
			},
		});

		expect(result.exitCode).toBe(0);
		expect(receivedSession === TEST_SESSION).toBe(true);
	});

	test("exits 3 when adapter session validation fails", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["restaurants", "get", "rest_001"], {
			store,
			adapter: () => ({ ...createStubAdapter(), validateSession: async () => false }),
		});

		expect(result.exitCode).toBe(3);
		expect(result.stderr).toContain("beli auth bootstrap");
	});

	test("get exits 4 for unknown restaurant", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["restaurants", "get", "unknown"], { store });
		expect(result.exitCode).toBe(4);
		expect(result.stderr).toContain("not found");
	});
});
