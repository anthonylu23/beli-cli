import { UpstreamError, ValidationError } from "@core/errors.ts";
import type { PaginatedResult } from "@core/pagination.ts";
import type { EntityId } from "@core/types.ts";
import type { BeliAdapter, PaginationOptions, SearchRestaurantsOptions } from "./contract.ts";
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

/** Create a BeliAdapter backed by in-memory fixture data. */
export function createStubAdapter(): BeliAdapter {
	const me = FIXTURE_USERS[0];
	if (!me) throw new Error("FIXTURE_USERS must have at least one entry");

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
			return paginate(FIXTURE_RATINGS, options);
		},

		async getRating(id) {
			return findOrThrow(FIXTURE_RATINGS, id, "Rating");
		},

		async getReviewsForRestaurant(restaurantId, options) {
			const filtered = FIXTURE_REVIEWS.filter((r) => r.restaurantId === restaurantId);
			return paginate(filtered, options);
		},

		async getVisits(options) {
			return paginate(FIXTURE_VISITS, options);
		},

		async getLists(options) {
			return paginate(FIXTURE_LISTS, options);
		},

		async getList(id) {
			return findOrThrow(FIXTURE_LISTS, id, "List");
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
