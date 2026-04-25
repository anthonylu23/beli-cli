import { UpstreamError, ValidationError } from "@core/errors.ts";
import type { PaginatedResult } from "@core/pagination.ts";
import { entityId, timestamp } from "@core/types.ts";
import type { EntityId } from "@core/types.ts";
import type {
	AddListEntryInput,
	BeliAdapter,
	CreateListInput,
	CreateRatingInput,
	CreateReviewInput,
	PaginationOptions,
	SearchRestaurantsOptions,
	UpdateListInput,
	UpdateRatingInput,
	UpdateReviewInput,
} from "./contract.ts";
import {
	FIXTURE_FEED_ITEMS,
	FIXTURE_LISTS,
	FIXTURE_RATINGS,
	FIXTURE_RESTAURANTS,
	FIXTURE_REVIEWS,
	FIXTURE_USERS,
	FIXTURE_VISITS,
} from "./fixtures.ts";

function paginate<T>(items: readonly T[], options?: PaginationOptions): PaginatedResult<T> {
	const limit = options?.limit ?? 20;
	const startIndex = parseCursor(options?.cursor, items.length);
	const slice = items.slice(startIndex, startIndex + limit);
	const nextIndex = startIndex + limit;
	return {
		items: slice,
		nextCursor: nextIndex < items.length ? String(nextIndex) : null,
	};
}

function parseCursor(cursor: string | undefined, itemCount: number): number {
	if (cursor === undefined) return 0;
	if (!/^\d+$/.test(cursor)) {
		throw new ValidationError("--cursor must be an unsigned integer", "cursor");
	}

	const index = Number(cursor);
	if (!Number.isSafeInteger(index) || index < 0 || index > itemCount) {
		throw new ValidationError("--cursor is out of range", "cursor");
	}
	return index;
}

function findOrThrow<T extends { readonly id: EntityId<string> }>(
	items: readonly T[],
	id: EntityId<string>,
	label: string,
): T {
	const found = items.find((item) => item.id === id);
	if (!found) throw new UpstreamError(`${label} not found`, 404);
	return found;
}

function now() {
	return timestamp(new Date().toISOString());
}

function cloneLists() {
	return FIXTURE_LISTS.map((list) => ({
		...list,
		entries: list.entries.map((entry) => ({ ...entry })),
	}));
}

function cloneRatings() {
	return FIXTURE_RATINGS.map((rating) => ({
		...rating,
		favoriteDishes: [...rating.favoriteDishes],
		tags: [...rating.tags],
	}));
}

function cloneReviews() {
	return FIXTURE_REVIEWS.map((review) => ({
		...review,
		imageUrls: [...review.imageUrls],
	}));
}

function normalizeName(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) {
		throw new ValidationError("List name must be non-empty", "name");
	}
	return trimmed;
}

function normalizeDescription(description: string | null | undefined): string | null {
	if (description === undefined || description === null) return null;
	const trimmed = description.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function assertVisibility(visibility: unknown): asserts visibility is "public" | "private" {
	if (visibility !== "public" && visibility !== "private") {
		throw new ValidationError("List visibility must be public or private", "visibility");
	}
}

function normalizeScore(score: number): number {
	if (!Number.isFinite(score) || score < 0 || score > 10) {
		throw new ValidationError("Rating score must be between 0 and 10", "score");
	}
	return score;
}

function sentimentForScore(score: number): "positive" | "neutral" | "negative" {
	if (score >= 7) return "positive";
	if (score >= 4) return "neutral";
	return "negative";
}

function normalizeStringArray(values: readonly string[] | undefined, field: string): string[] {
	if (values === undefined) return [];
	for (const value of values) {
		if (typeof value !== "string") {
			throw new ValidationError(`${field} must contain only strings`, field);
		}
	}
	return values.map((value) => value.trim()).filter(Boolean);
}

function normalizeBody(body: string): string {
	const trimmed = body.trim();
	if (!trimmed) {
		throw new ValidationError("Review body must be non-empty", "body");
	}
	return trimmed;
}

/** Create a BeliAdapter backed by in-memory fixture data. */
export function createStubAdapter(): BeliAdapter {
	const me = FIXTURE_USERS[0];
	if (!me) throw new Error("FIXTURE_USERS must have at least one entry");
	const lists = cloneLists();
	const ratings = cloneRatings();
	const reviews = cloneReviews();
	let nextListNumber = lists.length + 1;
	let nextRatingNumber = ratings.length + 1;
	let nextReviewNumber = reviews.length + 1;

	return {
		async validateSession() {
			return true;
		},

		async getMe() {
			return me;
		},

		async getUser(id) {
			return findOrThrow(FIXTURE_USERS, id, "User");
		},

		async getFollowers(options) {
			const others = FIXTURE_USERS.filter((u) => u.id !== me.id);
			return paginate(others, options);
		},

		async getFollowing(options) {
			const others = FIXTURE_USERS.filter((u) => u.id !== me.id);
			return paginate(others, options);
		},

		async searchRestaurants(options: SearchRestaurantsOptions) {
			const q = options.query.toLowerCase();
			const filtered = FIXTURE_RESTAURANTS.filter(
				(r) =>
					r.name.toLowerCase().includes(q) || r.cuisines.some((c) => c.toLowerCase().includes(q)),
			);
			return paginate(filtered, options);
		},

		async getRestaurant(id) {
			return findOrThrow(FIXTURE_RESTAURANTS, id, "Restaurant");
		},

		async getRatings(options) {
			return paginate(ratings, options);
		},

		async getRating(id) {
			return findOrThrow(ratings, id, "Rating");
		},

		async createRating(input: CreateRatingInput) {
			findOrThrow(FIXTURE_RESTAURANTS, input.restaurantId, "Restaurant");
			const score = normalizeScore(input.score);
			const createdAt = now();
			const rating = {
				id: entityId<"Rating">(`rate_${String(nextRatingNumber).padStart(3, "0")}`),
				userId: me.id,
				restaurantId: input.restaurantId,
				score,
				sentiment: sentimentForScore(score),
				rank: null,
				favoriteDishes: normalizeStringArray(input.favoriteDishes, "favoriteDishes"),
				tags: normalizeStringArray(input.tags, "tags"),
				createdAt,
				updatedAt: createdAt,
			};
			nextRatingNumber += 1;
			ratings.push(rating);
			return rating;
		},

		async updateRating(id, input: UpdateRatingInput) {
			const existing = findOrThrow(ratings, id, "Rating");
			if (
				input.score === undefined &&
				input.favoriteDishes === undefined &&
				input.tags === undefined
			) {
				throw new ValidationError("At least one rating field must be provided", "input");
			}
			const score = input.score === undefined ? existing.score : normalizeScore(input.score);
			const updated = {
				...existing,
				score,
				sentiment: sentimentForScore(score),
				...(input.favoriteDishes !== undefined
					? { favoriteDishes: normalizeStringArray(input.favoriteDishes, "favoriteDishes") }
					: {}),
				...(input.tags !== undefined ? { tags: normalizeStringArray(input.tags, "tags") } : {}),
				updatedAt: now(),
			};
			const index = ratings.findIndex((rating) => rating.id === id);
			ratings[index] = updated;
			return updated;
		},

		async deleteRating(id) {
			const index = ratings.findIndex((rating) => rating.id === id);
			if (index === -1) throw new UpstreamError("Rating not found", 404);
			ratings.splice(index, 1);
		},

		async getReviewsForRestaurant(restaurantId, options) {
			const filtered = reviews.filter((r) => r.restaurantId === restaurantId);
			return paginate(filtered, options);
		},

		async createReview(input: CreateReviewInput) {
			findOrThrow(FIXTURE_RESTAURANTS, input.restaurantId, "Restaurant");
			if (input.ratingId !== undefined && input.ratingId !== null) {
				findOrThrow(ratings, input.ratingId, "Rating");
			}
			const createdAt = now();
			const review = {
				id: entityId<"Review">(`rev_${String(nextReviewNumber).padStart(3, "0")}`),
				userId: me.id,
				restaurantId: input.restaurantId,
				ratingId: input.ratingId ?? null,
				body: normalizeBody(input.body),
				imageUrls: normalizeStringArray(input.imageUrls, "imageUrls"),
				createdAt,
				updatedAt: createdAt,
			};
			nextReviewNumber += 1;
			reviews.push(review);
			return review;
		},

		async updateReview(id, input: UpdateReviewInput) {
			const existing = findOrThrow(reviews, id, "Review");
			if (input.body === undefined && input.imageUrls === undefined) {
				throw new ValidationError("At least one review field must be provided", "input");
			}
			const updated = {
				...existing,
				...(input.body !== undefined ? { body: normalizeBody(input.body) } : {}),
				...(input.imageUrls !== undefined
					? { imageUrls: normalizeStringArray(input.imageUrls, "imageUrls") }
					: {}),
				updatedAt: now(),
			};
			const index = reviews.findIndex((review) => review.id === id);
			reviews[index] = updated;
			return updated;
		},

		async deleteReview(id) {
			const index = reviews.findIndex((review) => review.id === id);
			if (index === -1) throw new UpstreamError("Review not found", 404);
			reviews.splice(index, 1);
		},

		async getVisits(options) {
			return paginate(FIXTURE_VISITS, options);
		},

		async getLists(options) {
			return paginate(lists, options);
		},

		async getList(id) {
			return findOrThrow(lists, id, "List");
		},

		async createList(input: CreateListInput) {
			if (input.visibility !== undefined) assertVisibility(input.visibility);
			const createdAt = now();
			const list = {
				id: entityId<"List">(`list_${String(nextListNumber).padStart(3, "0")}`),
				userId: me.id,
				name: normalizeName(input.name),
				description: normalizeDescription(input.description),
				visibility: input.visibility ?? "private",
				entries: [],
				entryCount: 0,
				createdAt,
				updatedAt: createdAt,
			};
			nextListNumber += 1;
			lists.push(list);
			return list;
		},

		async updateList(id, input: UpdateListInput) {
			const existing = findOrThrow(lists, id, "List");
			if (input.visibility !== undefined) assertVisibility(input.visibility);
			if (
				input.name === undefined &&
				input.description === undefined &&
				input.visibility === undefined
			) {
				throw new ValidationError("At least one list field must be provided", "input");
			}
			const updated = {
				...existing,
				...(input.name !== undefined ? { name: normalizeName(input.name) } : {}),
				...(input.description !== undefined
					? { description: normalizeDescription(input.description) }
					: {}),
				...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
				updatedAt: now(),
			};
			const index = lists.findIndex((list) => list.id === id);
			lists[index] = updated;
			return updated;
		},

		async deleteList(id) {
			const index = lists.findIndex((list) => list.id === id);
			if (index === -1) throw new UpstreamError("List not found", 404);
			lists.splice(index, 1);
		},

		async addListEntry(id, input: AddListEntryInput) {
			const existing = findOrThrow(lists, id, "List");
			findOrThrow(FIXTURE_RESTAURANTS, input.restaurantId, "Restaurant");
			const updatedAt = now();
			const existingEntry = existing.entries.find(
				(entry) => entry.restaurantId === input.restaurantId,
			);
			const entries = existingEntry
				? existing.entries.map((entry) =>
						entry.restaurantId === input.restaurantId
							? { ...entry, notes: normalizeDescription(input.notes) }
							: entry,
					)
				: [
						...existing.entries,
						{
							restaurantId: input.restaurantId,
							addedAt: updatedAt,
							notes: normalizeDescription(input.notes),
						},
					];
			const updated = {
				...existing,
				entries,
				entryCount: entries.length,
				updatedAt,
			};
			const index = lists.findIndex((list) => list.id === id);
			lists[index] = updated;
			return updated;
		},

		async removeListEntry(id, restaurantId) {
			const existing = findOrThrow(lists, id, "List");
			findOrThrow(FIXTURE_RESTAURANTS, restaurantId, "Restaurant");
			const entries = existing.entries.filter((entry) => entry.restaurantId !== restaurantId);
			const updated = {
				...existing,
				entries,
				entryCount: entries.length,
				updatedAt: now(),
			};
			const index = lists.findIndex((list) => list.id === id);
			lists[index] = updated;
			return updated;
		},

		async getFeed(options) {
			return paginate(FIXTURE_FEED_ITEMS, options);
		},

		async getUserActivity(userId, options) {
			const filtered = FIXTURE_FEED_ITEMS.filter((f) => f.userId === userId);
			return paginate(filtered, options);
		},
	};
}
