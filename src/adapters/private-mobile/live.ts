import {
	AuthRequiredError,
	UnsupportedFeatureError,
	UpstreamError,
	ValidationError,
} from "@core/errors.ts";
import type { Session } from "@core/session.ts";
import type { EntityId } from "@core/types.ts";
import type {
	AddListEntryInput,
	BeliAdapter,
	CreateListInput,
	PaginationOptions,
	SearchRestaurantsOptions,
} from "./contract.ts";
import { mapListPage, mapListResponse, mapRestaurantPage, mapUserResponse } from "./mappers.ts";

export interface LiveAdapterOptions {
	readonly baseUrl: string;
	readonly fetchFn?: FetchFn | undefined;
	readonly timeoutMs?: number | undefined;
}

export type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type JsonObject = Record<string, unknown>;

interface RequestOptions {
	readonly method?: string | undefined;
	readonly query?: Record<string, string | number | null | undefined> | undefined;
	readonly body?: JsonObject | undefined;
	readonly authFailureAsFalse?: boolean | undefined;
}

const JSON_HEADERS = {
	Accept: "application/json",
	"Content-Type": "application/json",
};
const DEFAULT_TIMEOUT_MS = 15_000;

export function createLiveAdapter(session: Session, options: LiveAdapterOptions): BeliAdapter {
	const baseUrl = normalizeBaseUrl(options.baseUrl);
	const fetchFn: FetchFn = options.fetchFn ?? fetch;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
		throw new ValidationError("Live adapter timeout must be a positive safe integer", "timeoutMs");
	}

	async function requestJson(path: string, options: RequestOptions = {}): Promise<unknown> {
		const url = buildUrl(baseUrl, path, options.query);
		let response: Response;
		try {
			response = await fetchFn(url, {
				method: options.method ?? "GET",
				headers: {
					...JSON_HEADERS,
					Authorization: `Bearer ${session.credentials.authToken}`,
				},
				signal: AbortSignal.timeout(timeoutMs),
				...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
			});
		} catch (error) {
			throw new UpstreamError("Beli API request failed before receiving a response", undefined, {
				cause: error,
			});
		}

		return parseResponse(response, options);
	}

	function unsupported(method: string): never {
		throw new UnsupportedFeatureError(`Live adapter does not support ${method} yet.`);
	}

	return {
		async validateSession() {
			const result = await requestJson("/me", { authFailureAsFalse: true });
			if (result !== false) mapUserResponse(result);
			return result !== false;
		},

		async getMe() {
			return mapUserResponse(await requestJson("/me"));
		},

		async getUser() {
			unsupported("getUser");
		},

		async getFollowers() {
			unsupported("getFollowers");
		},

		async getFollowing() {
			unsupported("getFollowing");
		},

		async searchRestaurants(options: SearchRestaurantsOptions) {
			return mapRestaurantPage(
				await requestJson("/restaurants/search", {
					query: {
						q: options.query,
						cursor: options.cursor,
						limit: options.limit,
						latitude: options.latitude,
						longitude: options.longitude,
					},
				}),
			);
		},

		async getRestaurant() {
			unsupported("getRestaurant");
		},

		async getRatings() {
			unsupported("getRatings");
		},

		async getRating() {
			unsupported("getRating");
		},

		async createRating() {
			unsupported("createRating");
		},

		async updateRating() {
			unsupported("updateRating");
		},

		async deleteRating() {
			unsupported("deleteRating");
		},

		async getReviewsForRestaurant() {
			unsupported("getReviewsForRestaurant");
		},

		async createReview() {
			unsupported("createReview");
		},

		async updateReview() {
			unsupported("updateReview");
		},

		async deleteReview() {
			unsupported("deleteReview");
		},

		async getVisits() {
			unsupported("getVisits");
		},

		async getLists(options?: PaginationOptions) {
			return mapListPage(
				await requestJson("/lists", {
					query: {
						cursor: options?.cursor,
						limit: options?.limit,
					},
				}),
			);
		},

		async getList(id: EntityId<"List">) {
			return mapListResponse(await requestJson(`/lists/${encodeURIComponent(id)}`));
		},

		async createList(input: CreateListInput) {
			return mapListResponse(
				await requestJson("/lists", {
					method: "POST",
					body: {
						name: input.name,
						description: input.description ?? null,
						visibility: input.visibility ?? "private",
					},
				}),
			);
		},

		async updateList() {
			unsupported("updateList");
		},

		async deleteList(id: EntityId<"List">) {
			await requestJson(`/lists/${encodeURIComponent(id)}`, { method: "DELETE" });
		},

		async addListEntry(id: EntityId<"List">, input: AddListEntryInput) {
			return mapListResponse(
				await requestJson(`/lists/${encodeURIComponent(id)}/entries`, {
					method: "POST",
					body: {
						restaurant_id: input.restaurantId,
						notes: input.notes ?? null,
					},
				}),
			);
		},

		async removeListEntry(id: EntityId<"List">, restaurantId: EntityId<"Restaurant">) {
			return mapListResponse(
				await requestJson(
					`/lists/${encodeURIComponent(id)}/entries/${encodeURIComponent(restaurantId)}`,
					{ method: "DELETE" },
				),
			);
		},

		async getFeed() {
			unsupported("getFeed");
		},

		async getUserActivity() {
			unsupported("getUserActivity");
		},
	};
}

async function parseResponse(response: Response, options: RequestOptions): Promise<unknown> {
	if (response.status === 401 || response.status === 403) {
		if (options.authFailureAsFalse) return false;
		throw new AuthRequiredError(
			`Not authenticated. Run "beli auth bootstrap" to set up a session.`,
		);
	}

	if (response.status === 404) {
		throw new UpstreamError("Beli resource not found", 404);
	}

	if (!response.ok) {
		throw new UpstreamError(
			`Beli API request failed with status ${response.status}`,
			response.status,
		);
	}

	if (response.status === 204) return null;

	try {
		return await response.json();
	} catch (error) {
		throw new UpstreamError("Beli API returned invalid JSON", response.status, {
			cause: error,
		});
	}
}

function normalizeBaseUrl(baseUrl: string): string {
	const trimmed = baseUrl.trim();
	if (!trimmed) {
		throw new ValidationError("BELI_API_BASE_URL is required for live adapter mode", "baseUrl");
	}
	try {
		const url = new URL(trimmed);
		if (url.username || url.password) {
			throw new ValidationError(
				"BELI_API_BASE_URL must not contain embedded credentials",
				"baseUrl",
			);
		}
		const isLocalhost =
			url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
		if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalhost)) {
			throw new ValidationError(
				"BELI_API_BASE_URL must use HTTPS (HTTP is allowed only for localhost)",
				"baseUrl",
			);
		}
		return url.toString().replace(/\/$/, "");
	} catch (error) {
		if (error instanceof ValidationError) throw error;
		throw new ValidationError("BELI_API_BASE_URL must be a valid URL", "baseUrl", {
			cause: error,
		});
	}
}

function buildUrl(
	baseUrl: string,
	path: string,
	query?: Record<string, string | number | null | undefined>,
): URL {
	const url = new URL(`${baseUrl}${path}`);
	for (const [key, value] of Object.entries(query ?? {})) {
		if (value !== undefined && value !== null) {
			url.searchParams.set(key, String(value));
		}
	}
	return url;
}
