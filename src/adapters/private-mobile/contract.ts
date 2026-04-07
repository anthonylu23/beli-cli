import type { FeedItem, List, Rating, Restaurant, Review, User, Visit } from "@core/entities.ts";
import type { PaginatedResult } from "@core/pagination.ts";
import type { EntityId } from "@core/types.ts";

/** Options for paginated requests. */
export interface PaginationOptions {
	readonly cursor?: string | undefined;
	readonly limit?: number | undefined;
}

/** Options for restaurant search. */
export interface SearchRestaurantsOptions extends PaginationOptions {
	readonly query: string;
	readonly latitude?: number | undefined;
	readonly longitude?: number | undefined;
}

/**
 * The contract that any Beli API adapter must implement.
 *
 * Core logic depends on this interface, never on the concrete adapter.
 * The private-mobile adapter will implement this against the Beli mobile API.
 *
 * All methods return Promises because they involve network I/O.
 * All methods throw BeliError subclasses on failure.
 */
export interface BeliAdapter {
	// ── Auth ──────────────────────────────────────────────────────────
	validateSession(): Promise<boolean>;

	// ── User ──────────────────────────────────────────────────────────
	getMe(): Promise<User>;
	getUser(id: EntityId<"User">): Promise<User>;
	getFollowers(options?: PaginationOptions): Promise<PaginatedResult<User>>;
	getFollowing(options?: PaginationOptions): Promise<PaginatedResult<User>>;

	// ── Restaurant ────────────────────────────────────────────────────
	searchRestaurants(options: SearchRestaurantsOptions): Promise<PaginatedResult<Restaurant>>;
	getRestaurant(id: EntityId<"Restaurant">): Promise<Restaurant>;

	// ── Rating ────────────────────────────────────────────────────────
	getRatings(options?: PaginationOptions): Promise<PaginatedResult<Rating>>;
	getRating(id: EntityId<"Rating">): Promise<Rating>;

	// ── Review ────────────────────────────────────────────────────────
	getReviewsForRestaurant(
		restaurantId: EntityId<"Restaurant">,
		options?: PaginationOptions,
	): Promise<PaginatedResult<Review>>;

	// ── Visit ─────────────────────────────────────────────────────────
	getVisits(options?: PaginationOptions): Promise<PaginatedResult<Visit>>;

	// ── List ──────────────────────────────────────────────────────────
	getLists(options?: PaginationOptions): Promise<PaginatedResult<List>>;
	getList(id: EntityId<"List">): Promise<List>;

	// ── Feed ──────────────────────────────────────────────────────────
	getFeed(options?: PaginationOptions): Promise<PaginatedResult<FeedItem>>;
	getUserActivity(
		userId: EntityId<"User">,
		options?: PaginationOptions,
	): Promise<PaginatedResult<FeedItem>>;
}
