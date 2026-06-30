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

	test("paginate rejects zero, negative, and unsafe limits", async () => {
		await expect(adapter.getRatings({ limit: 0 })).rejects.toThrow(ValidationError);
		await expect(adapter.getRatings({ limit: -1 })).rejects.toThrow(ValidationError);
		await expect(adapter.getRatings({ limit: Number.MAX_SAFE_INTEGER + 1 })).rejects.toThrow(
			ValidationError,
		);
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

	test("createRating creates a rating and derives sentiment", async () => {
		const mutableAdapter = createStubAdapter();
		const rating = await mutableAdapter.createRating({
			restaurantId: entityId<"Restaurant">("rest_002"),
			score: 8.5,
			favoriteDishes: ["Morning bun"],
			tags: ["brunch"],
		});
		expect(rating.id).toBe(entityId<"Rating">("rate_005"));
		expect(rating.restaurantId).toBe(entityId<"Restaurant">("rest_002"));
		expect(rating.sentiment).toBe("positive");
		expect(rating.rank).toBeNull();
		expect(rating.favoriteDishes).toEqual(["Morning bun"]);
	});

	test("createRating derives neutral and negative sentiment", async () => {
		const mutableAdapter = createStubAdapter();
		const neutral = await mutableAdapter.createRating({
			restaurantId: entityId<"Restaurant">("rest_002"),
			score: 4,
		});
		const negative = await mutableAdapter.createRating({
			restaurantId: entityId<"Restaurant">("rest_003"),
			score: 3.9,
		});
		expect(neutral.sentiment).toBe("neutral");
		expect(negative.sentiment).toBe("negative");
	});

	test("createRating rejects invalid scores and unknown restaurants", async () => {
		const mutableAdapter = createStubAdapter();
		await expect(
			mutableAdapter.createRating({
				restaurantId: entityId<"Restaurant">("rest_001"),
				score: 11,
			}),
		).rejects.toThrow(ValidationError);
		await expect(
			mutableAdapter.createRating({
				restaurantId: entityId<"Restaurant">("unknown"),
				score: 8,
			}),
		).rejects.toThrow(UpstreamError);
	});

	test("updateRating updates score and arrays", async () => {
		const mutableAdapter = createStubAdapter();
		const rating = await mutableAdapter.updateRating(entityId<"Rating">("rate_001"), {
			score: 2,
			favoriteDishes: ["Plain slice"],
			tags: ["changed"],
		});
		expect(rating.score).toBe(2);
		expect(rating.sentiment).toBe("negative");
		expect(rating.favoriteDishes).toEqual(["Plain slice"]);
		expect(rating.tags).toEqual(["changed"]);
	});

	test("updateRating rejects empty payloads and unknown IDs", async () => {
		const mutableAdapter = createStubAdapter();
		await expect(mutableAdapter.updateRating(entityId<"Rating">("rate_001"), {})).rejects.toThrow(
			ValidationError,
		);
		await expect(
			mutableAdapter.updateRating(entityId<"Rating">("unknown"), { score: 8 }),
		).rejects.toThrow(UpstreamError);
	});

	test("deleteRating removes a rating", async () => {
		const mutableAdapter = createStubAdapter();
		await mutableAdapter.deleteRating(entityId<"Rating">("rate_001"));
		await expect(mutableAdapter.getRating(entityId<"Rating">("rate_001"))).rejects.toThrow(
			UpstreamError,
		);
	});

	test("deleteRating rejects unknown IDs", async () => {
		const mutableAdapter = createStubAdapter();
		await expect(mutableAdapter.deleteRating(entityId<"Rating">("unknown"))).rejects.toThrow(
			UpstreamError,
		);
	});

	test("getLists returns lists", async () => {
		const result = await adapter.getLists();
		expect(result.items.length).toBeGreaterThan(0);
	});

	test("getList throws for unknown ID", async () => {
		await expect(adapter.getList(entityId<"List">("unknown"))).rejects.toThrow(UpstreamError);
	});

	test("createList creates a private list by default", async () => {
		const mutableAdapter = createStubAdapter();
		const list = await mutableAdapter.createList({ name: "  Weekend Ideas  " });
		expect(list.id).toBe(entityId<"List">("list_004"));
		expect(list.name).toBe("Weekend Ideas");
		expect(list.description).toBeNull();
		expect(list.visibility).toBe("private");
		expect(list.entryCount).toBe(0);
	});

	test("createList preserves explicit description and visibility", async () => {
		const mutableAdapter = createStubAdapter();
		const list = await mutableAdapter.createList({
			name: "Shared",
			description: "For friends",
			visibility: "public",
		});
		expect(list.description).toBe("For friends");
		expect(list.visibility).toBe("public");
	});

	test("createList rejects blank names and invalid visibility", async () => {
		const mutableAdapter = createStubAdapter();
		await expect(mutableAdapter.createList({ name: " " })).rejects.toThrow(ValidationError);
		await expect(
			mutableAdapter.createList({
				name: "Bad visibility",
				visibility: "friends" as "public",
			}),
		).rejects.toThrow(ValidationError);
	});

	test("updateList updates provided fields", async () => {
		const mutableAdapter = createStubAdapter();
		const list = await mutableAdapter.updateList(entityId<"List">("list_001"), {
			name: "Updated Pizza",
			description: null,
			visibility: "private",
		});
		expect(list.name).toBe("Updated Pizza");
		expect(list.description).toBeNull();
		expect(list.visibility).toBe("private");
	});

	test("updateList rejects empty payloads and unknown IDs", async () => {
		const mutableAdapter = createStubAdapter();
		await expect(mutableAdapter.updateList(entityId<"List">("list_001"), {})).rejects.toThrow(
			ValidationError,
		);
		await expect(
			mutableAdapter.updateList(entityId<"List">("unknown"), { name: "Missing" }),
		).rejects.toThrow(UpstreamError);
	});

	test("deleteList removes a list", async () => {
		const mutableAdapter = createStubAdapter();
		await mutableAdapter.deleteList(entityId<"List">("list_001"));
		await expect(mutableAdapter.getList(entityId<"List">("list_001"))).rejects.toThrow(
			UpstreamError,
		);
	});

	test("deleteList rejects unknown IDs", async () => {
		const mutableAdapter = createStubAdapter();
		await expect(mutableAdapter.deleteList(entityId<"List">("unknown"))).rejects.toThrow(
			UpstreamError,
		);
	});

	test("addListEntry adds a restaurant to a list", async () => {
		const mutableAdapter = createStubAdapter();
		const list = await mutableAdapter.addListEntry(entityId<"List">("list_001"), {
			restaurantId: entityId<"Restaurant">("rest_002"),
			notes: "Try brunch",
		});
		expect(list.entryCount).toBe(2);
		expect(list.entries.at(-1)).toMatchObject({
			restaurantId: "rest_002",
			notes: "Try brunch",
		});
	});

	test("addListEntry updates duplicate entries instead of adding another", async () => {
		const mutableAdapter = createStubAdapter();
		const list = await mutableAdapter.addListEntry(entityId<"List">("list_001"), {
			restaurantId: entityId<"Restaurant">("rest_001"),
			notes: "Updated note",
		});
		expect(list.entryCount).toBe(1);
		expect(list.entries[0]?.notes).toBe("Updated note");
	});

	test("addListEntry rejects unknown lists and restaurants", async () => {
		const mutableAdapter = createStubAdapter();
		await expect(
			mutableAdapter.addListEntry(entityId<"List">("unknown"), {
				restaurantId: entityId<"Restaurant">("rest_001"),
			}),
		).rejects.toThrow(UpstreamError);
		await expect(
			mutableAdapter.addListEntry(entityId<"List">("list_001"), {
				restaurantId: entityId<"Restaurant">("unknown"),
			}),
		).rejects.toThrow(UpstreamError);
	});

	test("removeListEntry removes a matching entry", async () => {
		const mutableAdapter = createStubAdapter();
		const list = await mutableAdapter.removeListEntry(
			entityId<"List">("list_001"),
			entityId<"Restaurant">("rest_001"),
		);
		expect(list.entryCount).toBe(0);
		expect(list.entries).toHaveLength(0);
	});

	test("removeListEntry rejects unknown restaurants", async () => {
		const mutableAdapter = createStubAdapter();
		await expect(
			mutableAdapter.removeListEntry(
				entityId<"List">("list_001"),
				entityId<"Restaurant">("unknown"),
			),
		).rejects.toThrow(UpstreamError);
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

	test("createReview creates a review", async () => {
		const mutableAdapter = createStubAdapter();
		const review = await mutableAdapter.createReview({
			restaurantId: entityId<"Restaurant">("rest_001"),
			ratingId: entityId<"Rating">("rate_001"),
			body: "  Great slice.  ",
			imageUrls: ["https://example.com/slice.jpg"],
		});
		expect(review.id).toBe(entityId<"Review">("rev_003"));
		expect(review.body).toBe("Great slice.");
		expect(review.ratingId).toBe(entityId<"Rating">("rate_001"));
		expect(review.imageUrls).toEqual(["https://example.com/slice.jpg"]);
	});

	test("createReview rejects empty bodies and missing resources", async () => {
		const mutableAdapter = createStubAdapter();
		await expect(
			mutableAdapter.createReview({
				restaurantId: entityId<"Restaurant">("rest_001"),
				body: " ",
			}),
		).rejects.toThrow(ValidationError);
		await expect(
			mutableAdapter.createReview({
				restaurantId: entityId<"Restaurant">("unknown"),
				body: "Missing restaurant",
			}),
		).rejects.toThrow(UpstreamError);
		await expect(
			mutableAdapter.createReview({
				restaurantId: entityId<"Restaurant">("rest_001"),
				ratingId: entityId<"Rating">("unknown"),
				body: "Missing rating",
			}),
		).rejects.toThrow(UpstreamError);
	});

	test("createReview rejects a rating from a different restaurant", async () => {
		const mutableAdapter = createStubAdapter();
		const rating = await mutableAdapter.createRating({
			restaurantId: entityId<"Restaurant">("rest_001"),
			score: 8,
		});
		await expect(
			mutableAdapter.createReview({
				restaurantId: entityId<"Restaurant">("rest_002"),
				ratingId: rating.id,
				body: "Mismatch",
			}),
		).rejects.toThrow("same restaurant");
	});

	test("updateReview updates body and image URLs", async () => {
		const mutableAdapter = createStubAdapter();
		const review = await mutableAdapter.updateReview(entityId<"Review">("rev_001"), {
			body: "Updated review",
			imageUrls: ["https://example.com/updated.jpg"],
		});
		expect(review.body).toBe("Updated review");
		expect(review.imageUrls).toEqual(["https://example.com/updated.jpg"]);
	});

	test("updateReview rejects empty payloads and unknown IDs", async () => {
		const mutableAdapter = createStubAdapter();
		await expect(mutableAdapter.updateReview(entityId<"Review">("rev_001"), {})).rejects.toThrow(
			ValidationError,
		);
		await expect(
			mutableAdapter.updateReview(entityId<"Review">("unknown"), { body: "Missing" }),
		).rejects.toThrow(UpstreamError);
	});

	test("deleteReview removes a review", async () => {
		const mutableAdapter = createStubAdapter();
		await mutableAdapter.deleteReview(entityId<"Review">("rev_001"));
		const result = await mutableAdapter.getReviewsForRestaurant(entityId<"Restaurant">("rest_003"));
		expect(result.items.map((review) => review.id)).not.toContain(entityId<"Review">("rev_001"));
	});

	test("deleteReview rejects unknown IDs", async () => {
		const mutableAdapter = createStubAdapter();
		await expect(mutableAdapter.deleteReview(entityId<"Review">("unknown"))).rejects.toThrow(
			UpstreamError,
		);
	});

	test("getVisits returns visits", async () => {
		const result = await adapter.getVisits();
		expect(result.items.length).toBeGreaterThan(0);
	});
});
