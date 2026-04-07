import type { EntityId, Timestamp } from "./types.ts";

// ─── Specific ID types ──────────────────────────────────────────────

export type UserId = EntityId<"User">;
export type RestaurantId = EntityId<"Restaurant">;
export type ListId = EntityId<"List">;
export type RatingId = EntityId<"Rating">;
export type ReviewId = EntityId<"Review">;
export type VisitId = EntityId<"Visit">;
export type FeedItemId = EntityId<"FeedItem">;

// ─── Restaurant ─────────────────────────────────────────────────────

export interface Location {
	readonly latitude: number;
	readonly longitude: number;
	readonly address: string | null;
	readonly city: string | null;
	readonly state: string | null;
	readonly country: string | null;
	readonly postalCode: string | null;
}

export interface Restaurant {
	readonly id: RestaurantId;
	readonly name: string;
	readonly location: Location | null;
	readonly imageUrl: string | null;
	readonly priceLevel: number | null;
	readonly cuisines: readonly string[];
	readonly tags: readonly string[];
}

// ─── User ───────────────────────────────────────────────────────────

export interface UserStats {
	readonly totalRatings: number;
	readonly totalReviews: number;
	readonly totalLists: number;
	readonly followerCount: number;
	readonly followingCount: number;
}

export interface User {
	readonly id: UserId;
	readonly username: string;
	readonly displayName: string;
	readonly avatarUrl: string | null;
	readonly bio: string | null;
	readonly stats: UserStats | null;
	readonly createdAt: Timestamp | null;
}

// ─── Rating ─────────────────────────────────────────────────────────

export interface Rating {
	readonly id: RatingId;
	readonly userId: UserId;
	readonly restaurantId: RestaurantId;
	readonly score: number;
	readonly sentiment: "positive" | "neutral" | "negative";
	readonly rank: number | null;
	readonly favoriteDishes: readonly string[];
	readonly tags: readonly string[];
	readonly createdAt: Timestamp;
	readonly updatedAt: Timestamp;
}

// ─── Review ─────────────────────────────────────────────────────────

export interface Review {
	readonly id: ReviewId;
	readonly userId: UserId;
	readonly restaurantId: RestaurantId;
	readonly ratingId: RatingId | null;
	readonly body: string;
	readonly imageUrls: readonly string[];
	readonly createdAt: Timestamp;
	readonly updatedAt: Timestamp;
}

// ─── Visit ──────────────────────────────────────────────────────────

export interface Visit {
	readonly id: VisitId;
	readonly userId: UserId;
	readonly restaurantId: RestaurantId;
	readonly visitedAt: Timestamp;
	readonly companions: readonly UserId[];
	readonly notes: string | null;
}

// ─── List ───────────────────────────────────────────────────────────

export type ListVisibility = "public" | "private";

export interface ListEntry {
	readonly restaurantId: RestaurantId;
	readonly addedAt: Timestamp;
	readonly notes: string | null;
}

export interface List {
	readonly id: ListId;
	readonly userId: UserId;
	readonly name: string;
	readonly description: string | null;
	readonly visibility: ListVisibility;
	readonly entries: readonly ListEntry[];
	readonly entryCount: number;
	readonly createdAt: Timestamp;
	readonly updatedAt: Timestamp;
}

// ─── Feed ───────────────────────────────────────────────────────────

export type FeedItemType = "rating" | "review" | "visit" | "list_created" | "list_updated";

export interface FeedItem {
	readonly id: FeedItemId;
	readonly type: FeedItemType;
	readonly userId: UserId;
	readonly restaurantId: RestaurantId | null;
	readonly listId: ListId | null;
	readonly ratingId: RatingId | null;
	readonly reviewId: ReviewId | null;
	readonly visitId: VisitId | null;
	readonly createdAt: Timestamp;
}
