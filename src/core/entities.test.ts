import { describe, expect, it } from "bun:test";
import type { Restaurant, User } from "./entities.ts";
import { entityId, timestamp } from "./types.ts";

describe("entity construction", () => {
	it("creates a well-typed restaurant value", () => {
		const restaurant: Restaurant = {
			id: entityId<"Restaurant">("rest_123"),
			name: "Test Kitchen",
			location: null,
			imageUrl: null,
			priceLevel: null,
			cuisines: ["Italian"],
			tags: [],
		};

		expect(restaurant.id).toBe(entityId<"Restaurant">("rest_123"));
		expect(restaurant.name).toBe("Test Kitchen");
		expect(restaurant.cuisines).toEqual(["Italian"]);
	});

	it("creates a user with stats", () => {
		const user: User = {
			id: entityId<"User">("user_456"),
			username: "testuser",
			displayName: "Test User",
			avatarUrl: null,
			bio: null,
			stats: {
				totalRatings: 42,
				totalReviews: 10,
				totalLists: 3,
				followerCount: 100,
				followingCount: 50,
			},
			createdAt: timestamp("2025-01-15T12:00:00.000Z"),
		};

		expect(user.id).toBe(entityId<"User">("user_456"));
		expect(user.stats?.totalRatings).toBe(42);
	});

	it("preserves timestamp ISO string", () => {
		const ts = timestamp("2025-01-15T12:00:00.000Z");
		expect(ts).toBe(timestamp("2025-01-15T12:00:00.000Z"));
	});

	it("rejects invalid IDs and timestamps", () => {
		for (const id of ["", " ", "two words", "\u0000"]) {
			expect(() => entityId(id)).toThrow(TypeError);
		}
		for (const value of ["", "yesterday", "2025-01-15", "2025-13-99T00:00:00Z"]) {
			expect(() => timestamp(value)).toThrow(TypeError);
		}
	});
});
