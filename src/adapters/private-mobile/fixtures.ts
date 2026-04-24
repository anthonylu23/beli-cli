import type { FeedItem, List, Rating, Restaurant, Review, User, Visit } from "@core/entities.ts";
import { entityId, timestamp } from "@core/types.ts";

// ── Users ───────────────────────────────────────────────────────────

export const FIXTURE_USERS: readonly User[] = [
	{
		id: entityId<"User">("user_001"),
		username: "anthony",
		displayName: "Anthony",
		avatarUrl: "https://example.com/avatars/anthony.jpg",
		bio: "NYC food explorer",
		stats: {
			totalRatings: 142,
			totalReviews: 38,
			totalLists: 5,
			followerCount: 89,
			followingCount: 64,
		},
		createdAt: timestamp("2023-06-15T08:00:00.000Z"),
	},
	{
		id: entityId<"User">("user_002"),
		username: "maria",
		displayName: "Maria Chen",
		avatarUrl: "https://example.com/avatars/maria.jpg",
		bio: "Dim sum enthusiast",
		stats: {
			totalRatings: 87,
			totalReviews: 22,
			totalLists: 3,
			followerCount: 45,
			followingCount: 30,
		},
		createdAt: timestamp("2023-09-20T12:00:00.000Z"),
	},
	{
		id: entityId<"User">("user_003"),
		username: "jake",
		displayName: "Jake Rivera",
		avatarUrl: null,
		bio: null,
		stats: {
			totalRatings: 23,
			totalReviews: 5,
			totalLists: 1,
			followerCount: 12,
			followingCount: 18,
		},
		createdAt: timestamp("2024-01-10T16:30:00.000Z"),
	},
];

// ── Restaurants ─────────────────────────────────────────────────────

export const FIXTURE_RESTAURANTS: readonly Restaurant[] = [
	{
		id: entityId<"Restaurant">("rest_001"),
		name: "Joe's Pizza",
		location: {
			latitude: 40.7308,
			longitude: -73.9973,
			address: "7 Carmine St",
			city: "New York",
			state: "NY",
			country: "US",
			postalCode: "10014",
		},
		imageUrl: "https://example.com/joes.jpg",
		priceLevel: 1,
		cuisines: ["Pizza", "Italian"],
		tags: ["casual", "late-night"],
	},
	{
		id: entityId<"Restaurant">("rest_002"),
		name: "Tartine Bakery",
		location: {
			latitude: 37.7614,
			longitude: -122.4241,
			address: "600 Guerrero St",
			city: "San Francisco",
			state: "CA",
			country: "US",
			postalCode: "94110",
		},
		imageUrl: "https://example.com/tartine.jpg",
		priceLevel: 2,
		cuisines: ["Bakery", "French"],
		tags: ["brunch", "pastries"],
	},
	{
		id: entityId<"Restaurant">("rest_003"),
		name: "Alinea",
		location: {
			latitude: 41.9138,
			longitude: -87.6487,
			address: "1723 N Halsted St",
			city: "Chicago",
			state: "IL",
			country: "US",
			postalCode: "60614",
		},
		imageUrl: "https://example.com/alinea.jpg",
		priceLevel: 4,
		cuisines: ["American", "Molecular"],
		tags: ["fine-dining", "tasting-menu"],
	},
	{
		id: entityId<"Restaurant">("rest_004"),
		name: "Xi'an Famous Foods",
		location: {
			latitude: 40.7559,
			longitude: -73.9878,
			address: "34 W 45th St",
			city: "New York",
			state: "NY",
			country: "US",
			postalCode: "10036",
		},
		imageUrl: null,
		priceLevel: 1,
		cuisines: ["Chinese", "Noodles"],
		tags: ["casual", "quick"],
	},
	{
		id: entityId<"Restaurant">("rest_005"),
		name: "Pizzeria Bianco",
		location: {
			latitude: 33.45,
			longitude: -112.0667,
			address: "623 E Adams St",
			city: "Phoenix",
			state: "AZ",
			country: "US",
			postalCode: "85004",
		},
		imageUrl: "https://example.com/bianco.jpg",
		priceLevel: 2,
		cuisines: ["Pizza", "Italian"],
		tags: ["wood-fired"],
	},
];

// ── Ratings ─────────────────────────────────────────────────────────

export const FIXTURE_RATINGS: readonly Rating[] = [
	{
		id: entityId<"Rating">("rate_001"),
		userId: entityId<"User">("user_001"),
		restaurantId: entityId<"Restaurant">("rest_001"),
		score: 8.7,
		sentiment: "positive",
		rank: 3,
		favoriteDishes: ["Pepperoni slice", "Margherita"],
		tags: ["classic", "reliable"],
		createdAt: timestamp("2024-11-01T18:00:00.000Z"),
		updatedAt: timestamp("2024-11-01T18:00:00.000Z"),
	},
	{
		id: entityId<"Rating">("rate_002"),
		userId: entityId<"User">("user_001"),
		restaurantId: entityId<"Restaurant">("rest_003"),
		score: 9.5,
		sentiment: "positive",
		rank: 1,
		favoriteDishes: ["Tasting menu"],
		tags: ["special-occasion"],
		createdAt: timestamp("2024-12-15T20:00:00.000Z"),
		updatedAt: timestamp("2024-12-15T20:00:00.000Z"),
	},
	{
		id: entityId<"Rating">("rate_003"),
		userId: entityId<"User">("user_001"),
		restaurantId: entityId<"Restaurant">("rest_004"),
		score: 7.2,
		sentiment: "neutral",
		rank: 15,
		favoriteDishes: ["Biang biang noodles"],
		tags: [],
		createdAt: timestamp("2025-01-05T12:30:00.000Z"),
		updatedAt: timestamp("2025-01-05T12:30:00.000Z"),
	},
	{
		id: entityId<"Rating">("rate_004"),
		userId: entityId<"User">("user_002"),
		restaurantId: entityId<"Restaurant">("rest_002"),
		score: 8.9,
		sentiment: "positive",
		rank: 2,
		favoriteDishes: ["Morning bun", "Croque monsieur"],
		tags: ["brunch"],
		createdAt: timestamp("2025-02-14T10:00:00.000Z"),
		updatedAt: timestamp("2025-02-14T10:00:00.000Z"),
	},
];

// ── Reviews ─────────────────────────────────────────────────────────

export const FIXTURE_REVIEWS: readonly Review[] = [
	{
		id: entityId<"Review">("rev_001"),
		userId: entityId<"User">("user_001"),
		restaurantId: entityId<"Restaurant">("rest_003"),
		ratingId: entityId<"Rating">("rate_002"),
		body: "One of the most incredible dining experiences. Every course was a revelation.",
		imageUrls: ["https://example.com/alinea-1.jpg", "https://example.com/alinea-2.jpg"],
		createdAt: timestamp("2024-12-15T22:00:00.000Z"),
		updatedAt: timestamp("2024-12-15T22:00:00.000Z"),
	},
	{
		id: entityId<"Review">("rev_002"),
		userId: entityId<"User">("user_002"),
		restaurantId: entityId<"Restaurant">("rest_002"),
		ratingId: entityId<"Rating">("rate_004"),
		body: "The morning bun is worth the wait. Get there early.",
		imageUrls: [],
		createdAt: timestamp("2025-02-14T11:00:00.000Z"),
		updatedAt: timestamp("2025-02-14T11:00:00.000Z"),
	},
];

// ── Lists ───────────────────────────────────────────────────────────

export const FIXTURE_LISTS: readonly List[] = [
	{
		id: entityId<"List">("list_001"),
		userId: entityId<"User">("user_001"),
		name: "NYC Pizza Spots",
		description: "The best pizza in New York City",
		visibility: "public",
		entries: [
			{
				restaurantId: entityId<"Restaurant">("rest_001"),
				addedAt: timestamp("2024-11-01T18:00:00.000Z"),
				notes: "Classic NY slice",
			},
		],
		entryCount: 1,
		createdAt: timestamp("2024-10-01T08:00:00.000Z"),
		updatedAt: timestamp("2024-11-01T18:00:00.000Z"),
	},
	{
		id: entityId<"List">("list_002"),
		userId: entityId<"User">("user_001"),
		name: "Date Night",
		description: null,
		visibility: "private",
		entries: [
			{
				restaurantId: entityId<"Restaurant">("rest_003"),
				addedAt: timestamp("2024-12-15T20:00:00.000Z"),
				notes: null,
			},
		],
		entryCount: 1,
		createdAt: timestamp("2024-12-01T08:00:00.000Z"),
		updatedAt: timestamp("2024-12-15T20:00:00.000Z"),
	},
	{
		id: entityId<"List">("list_003"),
		userId: entityId<"User">("user_002"),
		name: "SF Brunch Guide",
		description: "Weekend brunch spots in San Francisco",
		visibility: "public",
		entries: [
			{
				restaurantId: entityId<"Restaurant">("rest_002"),
				addedAt: timestamp("2025-02-14T10:00:00.000Z"),
				notes: "Morning buns!",
			},
		],
		entryCount: 1,
		createdAt: timestamp("2025-01-15T08:00:00.000Z"),
		updatedAt: timestamp("2025-02-14T10:00:00.000Z"),
	},
];

// ── Feed Items ──────────────────────────────────────────────────────

export const FIXTURE_FEED_ITEMS: readonly FeedItem[] = [
	{
		id: entityId<"FeedItem">("feed_001"),
		type: "rating",
		userId: entityId<"User">("user_001"),
		restaurantId: entityId<"Restaurant">("rest_001"),
		listId: null,
		ratingId: entityId<"Rating">("rate_001"),
		reviewId: null,
		visitId: null,
		createdAt: timestamp("2024-11-01T18:00:00.000Z"),
	},
	{
		id: entityId<"FeedItem">("feed_002"),
		type: "review",
		userId: entityId<"User">("user_001"),
		restaurantId: entityId<"Restaurant">("rest_003"),
		listId: null,
		ratingId: entityId<"Rating">("rate_002"),
		reviewId: entityId<"Review">("rev_001"),
		visitId: null,
		createdAt: timestamp("2024-12-15T22:00:00.000Z"),
	},
	{
		id: entityId<"FeedItem">("feed_003"),
		type: "list_created",
		userId: entityId<"User">("user_001"),
		restaurantId: null,
		listId: entityId<"List">("list_001"),
		ratingId: null,
		reviewId: null,
		visitId: null,
		createdAt: timestamp("2024-10-01T08:00:00.000Z"),
	},
	{
		id: entityId<"FeedItem">("feed_004"),
		type: "rating",
		userId: entityId<"User">("user_002"),
		restaurantId: entityId<"Restaurant">("rest_002"),
		listId: null,
		ratingId: entityId<"Rating">("rate_004"),
		reviewId: null,
		visitId: null,
		createdAt: timestamp("2025-02-14T10:00:00.000Z"),
	},
	{
		id: entityId<"FeedItem">("feed_005"),
		type: "review",
		userId: entityId<"User">("user_002"),
		restaurantId: entityId<"Restaurant">("rest_002"),
		listId: null,
		ratingId: entityId<"Rating">("rate_004"),
		reviewId: entityId<"Review">("rev_002"),
		visitId: null,
		createdAt: timestamp("2025-02-14T11:00:00.000Z"),
	},
	{
		id: entityId<"FeedItem">("feed_006"),
		type: "list_created",
		userId: entityId<"User">("user_002"),
		restaurantId: null,
		listId: entityId<"List">("list_003"),
		ratingId: null,
		reviewId: null,
		visitId: null,
		createdAt: timestamp("2025-01-15T08:00:00.000Z"),
	},
	{
		id: entityId<"FeedItem">("feed_007"),
		type: "rating",
		userId: entityId<"User">("user_001"),
		restaurantId: entityId<"Restaurant">("rest_004"),
		listId: null,
		ratingId: entityId<"Rating">("rate_003"),
		reviewId: null,
		visitId: null,
		createdAt: timestamp("2025-01-05T12:30:00.000Z"),
	},
	{
		id: entityId<"FeedItem">("feed_008"),
		type: "list_updated",
		userId: entityId<"User">("user_001"),
		restaurantId: null,
		listId: entityId<"List">("list_002"),
		ratingId: null,
		reviewId: null,
		visitId: null,
		createdAt: timestamp("2024-12-15T20:00:00.000Z"),
	},
];

// ── Visits ──────────────────────────────────────────────────────────

export const FIXTURE_VISITS: readonly Visit[] = [
	{
		id: entityId<"Visit">("visit_001"),
		userId: entityId<"User">("user_001"),
		restaurantId: entityId<"Restaurant">("rest_001"),
		visitedAt: timestamp("2024-11-01T18:00:00.000Z"),
		companions: [entityId<"User">("user_002")],
		notes: "Quick slice after work",
	},
	{
		id: entityId<"Visit">("visit_002"),
		userId: entityId<"User">("user_001"),
		restaurantId: entityId<"Restaurant">("rest_003"),
		visitedAt: timestamp("2024-12-15T19:00:00.000Z"),
		companions: [],
		notes: "Anniversary dinner",
	},
];
