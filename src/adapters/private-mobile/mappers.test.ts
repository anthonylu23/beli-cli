import { describe, expect, test } from "bun:test";
import { UpstreamError } from "@core/errors.ts";
import { mapRestaurantResponse, mapUserResponse } from "./mappers.ts";

describe("private-mobile semantic mappers", () => {
	test("rejects out-of-range coordinates", () => {
		const restaurant = {
			id: "rest_1",
			name: "Test",
			location: { latitude: 91, longitude: 0 },
			priceLevel: null,
			cuisines: [],
			tags: [],
		};
		expect(() => mapRestaurantResponse(restaurant)).toThrow(UpstreamError);
		restaurant.location = { latitude: 0, longitude: -181 };
		expect(() => mapRestaurantResponse(restaurant)).toThrow(UpstreamError);
	});

	test("rejects invalid IDs, timestamps, counts, and price ranges", () => {
		expect(() =>
			mapUserResponse({
				id: "bad id",
				username: "user",
				displayName: "User",
				stats: {
					totalRatings: -1,
					totalReviews: 0,
					totalLists: 0,
					followerCount: 0,
					followingCount: 0,
				},
				createdAt: "not-a-timestamp",
			}),
		).toThrow(UpstreamError);
		expect(() =>
			mapRestaurantResponse({
				id: "rest_1",
				name: "Test",
				location: null,
				priceLevel: 5,
				cuisines: [],
				tags: [],
			}),
		).toThrow(UpstreamError);
	});
});
