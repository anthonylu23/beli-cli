import type {
	FeedItem,
	List,
	ListVisibility,
	Rating,
	Restaurant,
	Review,
	User,
	Visit,
} from "@core/entities.ts";
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

/** Input for creating a restaurant list. */
export interface CreateListInput {
	readonly name: string;
	readonly description?: string | null | undefined;
	readonly visibility?: ListVisibility | undefined;
}

/** Input for updating a restaurant list. */
export interface UpdateListInput {
	readonly name?: string | undefined;
	readonly description?: string | null | undefined;
	readonly visibility?: ListVisibility | undefined;
}

/** Input for adding a restaurant to a list. */
export interface AddListEntryInput {
	readonly restaurantId: EntityId<"Restaurant">;
	readonly notes?: string | null | undefined;
}

/** Input for creating a restaurant rating. */
export interface CreateRatingInput {
	readonly restaurantId: EntityId<"Restaurant">;
	readonly score: number;
	readonly favoriteDishes?: readonly string[] | undefined;
	readonly tags?: readonly string[] | undefined;
}

/** Input for updating a restaurant rating. */
export interface UpdateRatingInput {
	readonly score?: number | undefined;
	readonly favoriteDishes?: readonly string[] | undefined;
	readonly tags?: readonly string[] | undefined;
}

/** Input for creating a restaurant review. */
export interface CreateReviewInput {
	readonly restaurantId: EntityId<"Restaurant">;
	readonly body: string;
	readonly ratingId?: EntityId<"Rating"> | null | undefined;
	readonly imageUrls?: readonly string[] | undefined;
}

/** Input for updating a restaurant review. */
export interface UpdateReviewInput {
	readonly body?: string | undefined;
	readonly imageUrls?: readonly string[] | undefined;
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
	createRating(input: CreateRatingInput): Promise<Rating>;
	updateRating(id: EntityId<"Rating">, input: UpdateRatingInput): Promise<Rating>;
	deleteRating(id: EntityId<"Rating">): Promise<void>;

	// ── Review ────────────────────────────────────────────────────────
	getReviewsForRestaurant(
		restaurantId: EntityId<"Restaurant">,
		options?: PaginationOptions,
	): Promise<PaginatedResult<Review>>;
	createReview(input: CreateReviewInput): Promise<Review>;
	updateReview(id: EntityId<"Review">, input: UpdateReviewInput): Promise<Review>;
	deleteReview(id: EntityId<"Review">): Promise<void>;

	// ── Visit ─────────────────────────────────────────────────────────
	getVisits(options?: PaginationOptions): Promise<PaginatedResult<Visit>>;

	// ── List ──────────────────────────────────────────────────────────
	getLists(options?: PaginationOptions): Promise<PaginatedResult<List>>;
	getList(id: EntityId<"List">): Promise<List>;
	createList(input: CreateListInput): Promise<List>;
	updateList(id: EntityId<"List">, input: UpdateListInput): Promise<List>;
	deleteList(id: EntityId<"List">): Promise<void>;
	addListEntry(id: EntityId<"List">, input: AddListEntryInput): Promise<List>;
	removeListEntry(id: EntityId<"List">, restaurantId: EntityId<"Restaurant">): Promise<List>;

	// ── Feed ──────────────────────────────────────────────────────────
	getFeed(options?: PaginationOptions): Promise<PaginatedResult<FeedItem>>;
	getUserActivity(
		userId: EntityId<"User">,
		options?: PaginationOptions,
	): Promise<PaginatedResult<FeedItem>>;
}
