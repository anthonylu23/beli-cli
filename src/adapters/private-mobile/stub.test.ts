import { describe, expect, test } from "bun:test";
import { UpstreamError, ValidationError } from "@core/errors.ts";
import { entityId } from "@core/types.ts";
import { createStubAdapter } from "./stub.ts";

describe("createStubAdapter", () => {
	const adapter = createStubAdapter();

	test("validateSession returns true", async () => {
		expect(await adapter.validateSession()).toBe(true);
	});

	test("getMe returns the first fixture user", async () => {
		const me = await adapter.getMe();
		expect(me.id).toBe(entityId<"User">("user_001"));
		expect(me.username).toBeDefined();
	});

	test("getUser returns a user by ID", async () => {
		const user = await adapter.getUser(entityId<"User">("user_002"));
		expect(user.id).toBe(entityId<"User">("user_002"));
	});

	test("getUser throws UpstreamError for unknown ID", async () => {
		await expect(adapter.getUser(entityId<"User">("unknown"))).rejects.toThrow(UpstreamError);
	});

	test("getFollowers excludes the current user", async () => {
		const result = await adapter.getFollowers();
		const ids = result.items.map((u) => u.id);
		expect(ids).not.toContain(entityId<"User">("user_001"));
		expect(ids.length).toBeGreaterThan(0);
	});

	test("getFollowing excludes the current user", async () => {
		const result = await adapter.getFollowing();
		const ids = result.items.map((u) => u.id);
		expect(ids).not.toContain(entityId<"User">("user_001"));
	});

	test("searchRestaurants filters by name", async () => {
		const result = await adapter.searchRestaurants({ query: "pizza" });
		for (const r of result.items) {
			const matchesName = r.name.toLowerCase().includes("pizza");
			const matchesCuisine = r.cuisines.some((c) => c.toLowerCase().includes("pizza"));
			expect(matchesName || matchesCuisine).toBe(true);
		}
	});

	test("searchRestaurants returns empty for no match", async () => {
		const result = await adapter.searchRestaurants({ query: "xyznonexistent" });
		expect(result.items).toHaveLength(0);
	});

	test("getRestaurant throws for unknown ID", async () => {
		await expect(adapter.getRestaurant(entityId<"Restaurant">("unknown"))).rejects.toThrow(
			UpstreamError,
		);
	});

	test("paginate respects limit", async () => {
		const result = await adapter.getRatings({ limit: 2 });
		expect(result.items.length).toBeLessThanOrEqual(2);
	});

	test("paginate returns nextCursor when more items exist", async () => {
		const result = await adapter.getRatings({ limit: 1 });
		expect(result.nextCursor).not.toBeNull();
	});

	test("paginate with cursor resumes from correct position", async () => {
		const page1 = await adapter.getRatings({ limit: 1 });
		expect(page1.nextCursor).not.toBeNull();

		const page2 = await adapter.getRatings({ limit: 1, cursor: page1.nextCursor as string });
		expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
	});

	test("paginate rejects malformed cursor", async () => {
		await expect(adapter.getRatings({ cursor: "abc" })).rejects.toThrow(ValidationError);
	});

	test("paginate rejects out-of-range cursor", async () => {
		await expect(adapter.getRatings({ cursor: "999" })).rejects.toThrow(ValidationError);
	});

	test("paginate returns null nextCursor on last page", async () => {
		const result = await adapter.getRatings({ limit: 100 });
		expect(result.nextCursor).toBeNull();
	});

	test("getLists returns lists", async () => {
		const result = await adapter.getLists();
		expect(result.items.length).toBeGreaterThan(0);
	});

	test("getList throws for unknown ID", async () => {
		await expect(adapter.getList(entityId<"List">("unknown"))).rejects.toThrow(UpstreamError);
	});

	test("getFeed returns feed items", async () => {
		const result = await adapter.getFeed();
		expect(result.items.length).toBeGreaterThan(0);
	});

	test("getUserActivity filters by userId", async () => {
		const result = await adapter.getUserActivity(entityId<"User">("user_001"));
		for (const item of result.items) {
			expect(item.userId).toBe(entityId<"User">("user_001"));
		}
	});

	test("getReviewsForRestaurant filters by restaurantId", async () => {
		const result = await adapter.getReviewsForRestaurant(entityId<"Restaurant">("rest_001"));
		for (const review of result.items) {
			expect(review.restaurantId).toBe(entityId<"Restaurant">("rest_001"));
		}
	});

	test("getVisits returns visits", async () => {
		const result = await adapter.getVisits();
		expect(result.items.length).toBeGreaterThan(0);
	});
});
