import type { List, ListEntry, Restaurant, User, UserStats } from "@core/entities.ts";
import { UpstreamError } from "@core/errors.ts";
import type { PaginatedResult } from "@core/pagination.ts";
import { entityId, timestamp } from "@core/types.ts";
import type { EntityId, Timestamp } from "@core/types.ts";

type Mapper<T> = (value: unknown) => T;

export function mapUserResponse(value: unknown): User {
	return mapUser(unwrap(value, "user"));
}

export function mapRestaurantResponse(value: unknown): Restaurant {
	return mapRestaurant(unwrap(value, "restaurant"));
}

export function mapRestaurantPage(value: unknown): PaginatedResult<Restaurant> {
	return mapPage(value, ["restaurants", "items", "data"], mapRestaurant);
}

export function mapListResponse(value: unknown): List {
	return mapList(unwrap(value, "list"));
}

export function mapListPage(value: unknown): PaginatedResult<List> {
	return mapPage(value, ["lists", "items", "data"], mapList);
}

function mapUser(value: unknown): User {
	const record = requireRecord(value, "user");
	return {
		id: entityId<"User">(readString(record, ["id", "user_id"], "user.id")),
		username: readString(record, ["username"], "user.username"),
		displayName: readString(record, ["displayName", "display_name", "name"], "user.displayName"),
		avatarUrl: readNullableString(record, ["avatarUrl", "avatar_url"], "user.avatarUrl"),
		bio: readNullableString(record, ["bio"], "user.bio"),
		stats: readOptionalStats(record.stats),
		createdAt: readNullableTimestamp(record, ["createdAt", "created_at"], "user.createdAt"),
	};
}

function mapRestaurant(value: unknown): Restaurant {
	const record = requireRecord(value, "restaurant");
	return {
		id: entityId<"Restaurant">(readString(record, ["id", "restaurant_id"], "restaurant.id")),
		name: readString(record, ["name"], "restaurant.name"),
		location: mapLocation(record.location),
		imageUrl: readNullableString(record, ["imageUrl", "image_url"], "restaurant.imageUrl"),
		priceLevel: readNullableNumber(record, ["priceLevel", "price_level"], "restaurant.priceLevel"),
		cuisines: readStringArray(record, ["cuisines"], "restaurant.cuisines"),
		tags: readStringArray(record, ["tags"], "restaurant.tags"),
	};
}

function mapList(value: unknown): List {
	const record = requireRecord(value, "list");
	const entries = readArray(record, ["entries"], "list.entries").map(mapListEntry);
	return {
		id: entityId<"List">(readString(record, ["id", "list_id"], "list.id")),
		userId: entityId<"User">(readString(record, ["userId", "user_id"], "list.userId")),
		name: readString(record, ["name"], "list.name"),
		description: readNullableString(record, ["description"], "list.description"),
		visibility: readVisibility(record, ["visibility"], "list.visibility"),
		entries,
		entryCount: readOptionalNumber(record, ["entryCount", "entry_count"]) ?? entries.length,
		createdAt: readTimestamp(record, ["createdAt", "created_at"], "list.createdAt"),
		updatedAt: readTimestamp(record, ["updatedAt", "updated_at"], "list.updatedAt"),
	};
}

function mapListEntry(value: unknown): ListEntry {
	const record = requireRecord(value, "list.entries[]");
	return {
		restaurantId: entityId<"Restaurant">(
			readString(record, ["restaurantId", "restaurant_id"], "list.entries[].restaurantId"),
		),
		addedAt: readTimestamp(record, ["addedAt", "added_at"], "list.entries[].addedAt"),
		notes: readNullableString(record, ["notes"], "list.entries[].notes"),
	};
}

function mapLocation(value: unknown): Restaurant["location"] {
	if (value === null || value === undefined) return null;
	const record = requireRecord(value, "restaurant.location");
	return {
		latitude: readNumber(record, ["latitude", "lat"], "restaurant.location.latitude"),
		longitude: readNumber(record, ["longitude", "lng"], "restaurant.location.longitude"),
		address: readNullableString(record, ["address"], "restaurant.location.address"),
		city: readNullableString(record, ["city"], "restaurant.location.city"),
		state: readNullableString(record, ["state"], "restaurant.location.state"),
		country: readNullableString(record, ["country"], "restaurant.location.country"),
		postalCode: readNullableString(
			record,
			["postalCode", "postal_code"],
			"restaurant.location.postalCode",
		),
	};
}

function readOptionalStats(value: unknown): UserStats | null {
	if (value === null || value === undefined) return null;
	const record = requireRecord(value, "user.stats");
	return {
		totalRatings: readNumber(record, ["totalRatings", "total_ratings"], "user.stats.totalRatings"),
		totalReviews: readNumber(record, ["totalReviews", "total_reviews"], "user.stats.totalReviews"),
		totalLists: readNumber(record, ["totalLists", "total_lists"], "user.stats.totalLists"),
		followerCount: readNumber(
			record,
			["followerCount", "follower_count"],
			"user.stats.followerCount",
		),
		followingCount: readNumber(
			record,
			["followingCount", "following_count"],
			"user.stats.followingCount",
		),
	};
}

function mapPage<T>(
	value: unknown,
	keys: readonly string[],
	mapItem: Mapper<T>,
): PaginatedResult<T> {
	const record = requireRecord(value, "page");
	const itemsValue = readFirst(record, keys);
	if (!Array.isArray(itemsValue)) {
		throw schemaError(`Expected page to include an array at ${keys.join(" or ")}`);
	}
	return {
		items: itemsValue.map(mapItem),
		nextCursor: readNullableString(record, ["nextCursor", "next_cursor"], "page.nextCursor"),
	};
}

function unwrap(value: unknown, key: string): unknown {
	if (isRecord(value) && key in value) return value[key];
	return value;
}

function readString(
	record: Record<string, unknown>,
	keys: readonly string[],
	label: string,
): string {
	const value = readFirst(record, keys);
	if (typeof value !== "string" || value.length === 0) {
		throw schemaError(`Expected ${label} to be a non-empty string`);
	}
	return value;
}

function readNullableString(
	record: Record<string, unknown>,
	keys: readonly string[],
	label: string,
): string | null {
	const value = readFirst(record, keys);
	if (value === undefined || value === null) return null;
	if (typeof value !== "string") throw schemaError(`Expected ${label} to be a string or null`);
	return value;
}

function readStringArray(
	record: Record<string, unknown>,
	keys: readonly string[],
	label: string,
): readonly string[] {
	const value = readFirst(record, keys);
	if (value === undefined) return [];
	if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
		throw schemaError(`Expected ${label} to be an array of strings`);
	}
	return value;
}

function readArray(
	record: Record<string, unknown>,
	keys: readonly string[],
	label: string,
): readonly unknown[] {
	const value = readFirst(record, keys);
	if (value === undefined) return [];
	if (!Array.isArray(value)) throw schemaError(`Expected ${label} to be an array`);
	return value;
}

function readNumber(
	record: Record<string, unknown>,
	keys: readonly string[],
	label: string,
): number {
	const value = readFirst(record, keys);
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw schemaError(`Expected ${label} to be a finite number`);
	}
	return value;
}

function readOptionalNumber(
	record: Record<string, unknown>,
	keys: readonly string[],
): number | undefined {
	const value = readFirst(record, keys);
	if (value === undefined) return undefined;
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw schemaError(`Expected ${keys[0]} to be a finite number`);
	}
	return value;
}

function readNullableNumber(
	record: Record<string, unknown>,
	keys: readonly string[],
	label: string,
): number | null {
	const value = readFirst(record, keys);
	if (value === undefined || value === null) return null;
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw schemaError(`Expected ${label} to be a finite number or null`);
	}
	return value;
}

function readVisibility(
	record: Record<string, unknown>,
	keys: readonly string[],
	label: string,
): "public" | "private" {
	const value = readFirst(record, keys);
	if (value !== "public" && value !== "private") {
		throw schemaError(`Expected ${label} to be public or private`);
	}
	return value;
}

function readTimestamp(
	record: Record<string, unknown>,
	keys: readonly string[],
	label: string,
): Timestamp {
	return timestamp(readString(record, keys, label));
}

function readNullableTimestamp(
	record: Record<string, unknown>,
	keys: readonly string[],
	label: string,
): Timestamp | null {
	const value = readNullableString(record, keys, label);
	return value === null ? null : timestamp(value);
}

function readFirst(record: Record<string, unknown>, keys: readonly string[]): unknown {
	for (const key of keys) {
		if (key in record) return record[key];
	}
	return undefined;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
	if (!isRecord(value)) throw schemaError(`Expected ${label} to be an object`);
	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function schemaError(message: string): UpstreamError {
	return new UpstreamError(`Beli API response schema mismatch: ${message}`);
}
