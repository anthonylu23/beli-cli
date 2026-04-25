import type { FeedItem, List, Rating, Restaurant, Review, User } from "@core/entities.ts";
import type { PaginatedResult } from "@core/pagination.ts";

/** Treat a normalized entity as a top-level field-filterable output record. */
export function asOutputRecord<T extends object>(item: T): Record<string, unknown> {
	return item as unknown as Record<string, unknown>;
}

/** Transform PaginatedResult items through a flattener, preserving nextCursor. */
export function mapPaginated<T>(
	result: PaginatedResult<T>,
	fn: (item: T) => Record<string, unknown>,
): PaginatedResult<Record<string, unknown>> {
	return { items: result.items.map(fn), nextCursor: result.nextCursor };
}

export function flattenRestaurant(r: Restaurant): Record<string, unknown> {
	return {
		id: r.id,
		name: r.name,
		cuisines: r.cuisines.join(", "),
		priceLevel: r.priceLevel ?? "—",
		city: r.location?.city ?? "—",
		address: r.location?.address ?? "—",
		imageUrl: r.imageUrl,
		tags: r.tags.join(", "),
	};
}

export function flattenUser(u: User): Record<string, unknown> {
	return {
		id: u.id,
		username: u.username,
		displayName: u.displayName,
		avatarUrl: u.avatarUrl,
		bio: u.bio,
	};
}

export function flattenList(l: List): Record<string, unknown> {
	return {
		id: l.id,
		name: l.name,
		description: l.description,
		visibility: l.visibility,
		entryCount: l.entryCount,
		createdAt: l.createdAt,
		updatedAt: l.updatedAt,
	};
}

export function flattenRating(r: Rating): Record<string, unknown> {
	return {
		id: r.id,
		restaurantId: r.restaurantId,
		score: r.score,
		sentiment: r.sentiment,
		rank: r.rank,
		favoriteDishes: r.favoriteDishes.join(", "),
		tags: r.tags.join(", "),
		createdAt: r.createdAt,
		updatedAt: r.updatedAt,
	};
}

export function flattenReview(r: Review): Record<string, unknown> {
	return {
		id: r.id,
		restaurantId: r.restaurantId,
		ratingId: r.ratingId,
		body: r.body,
		imageUrls: r.imageUrls.join(", "),
		createdAt: r.createdAt,
		updatedAt: r.updatedAt,
	};
}

export function flattenFeedItem(f: FeedItem): Record<string, unknown> {
	return { ...f };
}
