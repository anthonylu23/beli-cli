import { describe, expect, test } from "bun:test";
import {
	AuthRequiredError,
	UnsupportedFeatureError,
	UpstreamError,
	ValidationError,
} from "@core/errors.ts";
import type { Session } from "@core/session.ts";
import { entityId, timestamp } from "@core/types.ts";
import { createLiveAdapter } from "./live.ts";

const FIXTURE_DIR = new URL("../../../docs/fixtures/private-mobile/", import.meta.url);

const TEST_SESSION: Session = {
	credentials: {
		authToken: "secret-live-token",
		refreshToken: null,
		userId: entityId<"User">("user_sanitized_001"),
	},
	metadata: {
		profile: "default",
		userId: entityId<"User">("user_sanitized_001"),
		username: "sanitized_user",
		displayName: "Sanitized User",
		bootstrappedAt: timestamp("2026-01-01T00:00:00.000Z"),
		lastValidatedAt: timestamp("2026-01-01T00:00:00.000Z"),
	},
};

describe("createLiveAdapter", () => {
	test("validates a session and attaches the bearer token", async () => {
		const requests: Request[] = [];
		const adapter = createLiveAdapter(TEST_SESSION, {
			baseUrl: "https://fixture.local",
			fetchFn: async (input, init) => {
				const request = makeRequest(input, init);
				requests.push(request);
				return jsonResponse(await fixture("me.json"));
			},
		});

		await expect(adapter.validateSession()).resolves.toBe(true);
		expect(requests[0]?.url).toBe("https://fixture.local/me");
		expect(requests[0]?.headers.get("authorization")).toBe("Bearer secret-live-token");
	});

	test("maps sanitized profile, restaurant search, and list fixtures", async () => {
		const adapter = createLiveAdapter(TEST_SESSION, {
			baseUrl: "https://fixture.local/api/",
			fetchFn: async (input, init) => {
				const request = makeRequest(input, init);
				if (request.url.includes("/me")) return jsonResponse(await fixture("me.json"));
				if (request.url.includes("/restaurants/search")) {
					return jsonResponse(await fixture("restaurants-search.json"));
				}
				if (request.url.endsWith("/lists")) return jsonResponse(await fixture("lists.json"));
				return jsonResponse(await fixture("list.json"));
			},
		});

		const me = await adapter.getMe();
		expect(String(me.id)).toBe("user_sanitized_001");
		expect(me.stats?.totalRatings).toBe(12);

		const restaurants = await adapter.searchRestaurants({ query: "pizza", limit: 1 });
		expect(String(restaurants.items[0]?.id)).toBe("rest_sanitized_001");
		expect(restaurants.nextCursor).toBeNull();

		const lists = await adapter.getLists();
		expect(String(lists.items[0]?.entries[0]?.restaurantId)).toBe("rest_sanitized_001");

		const list = await adapter.getList(entityId<"List">("list_sanitized_001"));
		expect(list.entryCount).toBe(1);
	});

	test("sends list mutation payloads and maps readback lists", async () => {
		const requests: Request[] = [];
		const adapter = createLiveAdapter(TEST_SESSION, {
			baseUrl: "https://fixture.local",
			fetchFn: async (input, init) => {
				const request = makeRequest(input, init);
				requests.push(request);
				if (request.method === "DELETE" && request.url.endsWith("/lists/list_sanitized_001")) {
					return new Response(null, { status: 204 });
				}
				return jsonResponse(await fixture("list.json"));
			},
		});

		await adapter.createList({ name: "beli-cli Smoke Test", visibility: "private" });
		await adapter.addListEntry(entityId<"List">("list_sanitized_001"), {
			restaurantId: entityId<"Restaurant">("rest_sanitized_001"),
			notes: "smoke",
		});
		await adapter.removeListEntry(
			entityId<"List">("list_sanitized_001"),
			entityId<"Restaurant">("rest_sanitized_001"),
		);
		await adapter.deleteList(entityId<"List">("list_sanitized_001"));

		expect(requests.map((request) => `${request.method} ${new URL(request.url).pathname}`)).toEqual(
			[
				"POST /lists",
				"POST /lists/list_sanitized_001/entries",
				"DELETE /lists/list_sanitized_001/entries/rest_sanitized_001",
				"DELETE /lists/list_sanitized_001",
			],
		);
		const createPayload = await requests[0]?.json();
		expect(createPayload).toMatchObject({
			name: "beli-cli Smoke Test",
			visibility: "private",
		});
	});

	test("maps HTTP failures without leaking tokens", async () => {
		const adapter = createLiveAdapter(TEST_SESSION, {
			baseUrl: "https://fixture.local",
			fetchFn: async () => new Response("expired secret-live-token", { status: 401 }),
		});

		await expect(adapter.validateSession()).resolves.toBe(false);
		await expect(adapter.getMe()).rejects.toThrow(AuthRequiredError);

		const notFound = createLiveAdapter(TEST_SESSION, {
			baseUrl: "https://fixture.local",
			fetchFn: async () => new Response("missing secret-live-token", { status: 404 }),
		});
		await expect(notFound.getList(entityId<"List">("missing"))).rejects.toThrow(UpstreamError);
		try {
			await notFound.getList(entityId<"List">("missing"));
		} catch (error) {
			expect(String(error)).not.toContain("secret-live-token");
		}
	});

	test("fails closed on malformed response shapes and unsupported methods", async () => {
		const adapter = createLiveAdapter(TEST_SESSION, {
			baseUrl: "https://fixture.local",
			fetchFn: async () => jsonResponse({ user: { id: "missing-required-fields" } }),
		});

		await expect(adapter.getMe()).rejects.toThrow(UpstreamError);
		await expect(adapter.getFeed()).rejects.toThrow(UnsupportedFeatureError);
	});

	test("wraps rejected fetches and preserves their cause", async () => {
		const cause = new TypeError("connection refused");
		const adapter = createLiveAdapter(TEST_SESSION, {
			baseUrl: "https://fixture.local",
			fetchFn: async () => {
				throw cause;
			},
		});

		try {
			await adapter.getMe();
			throw new Error("expected request to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(UpstreamError);
			expect((error as UpstreamError).cause).toBe(cause);
		}
	});

	test("aborts requests after the configured timeout and wraps the abort", async () => {
		const adapter = createLiveAdapter(TEST_SESSION, {
			baseUrl: "https://fixture.local",
			timeoutMs: 5,
			fetchFn: async (_input, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
						once: true,
					});
				}),
		});

		try {
			await adapter.getMe();
			throw new Error("expected request to time out");
		} catch (error) {
			expect(error).toBeInstanceOf(UpstreamError);
			expect((error as UpstreamError).cause).toBeInstanceOf(DOMException);
		}
	});

	test("rejects invalid JSON and 5xx responses", async () => {
		const invalidJson = createLiveAdapter(TEST_SESSION, {
			baseUrl: "https://fixture.local",
			fetchFn: async () =>
				new Response("{", { status: 200, headers: { "content-type": "application/json" } }),
		});
		await expect(invalidJson.getMe()).rejects.toThrow("invalid JSON");

		const serverError = createLiveAdapter(TEST_SESSION, {
			baseUrl: "https://fixture.local",
			fetchFn: async () => new Response("secret-live-token", { status: 503 }),
		});
		try {
			await serverError.getMe();
		} catch (error) {
			expect(error).toBeInstanceOf(UpstreamError);
			expect((error as UpstreamError).statusCode).toBe(503);
			expect(String(error)).not.toContain("secret-live-token");
		}
	});

	test("requires HTTPS except for localhost and rejects embedded credentials", () => {
		expect(() => createLiveAdapter(TEST_SESSION, { baseUrl: "http://api.example.com" })).toThrow(
			ValidationError,
		);
		expect(() =>
			createLiveAdapter(TEST_SESSION, { baseUrl: "https://user:pass@api.example.com" }),
		).toThrow("embedded credentials");
		expect(() =>
			createLiveAdapter(TEST_SESSION, { baseUrl: "http://localhost:3000" }),
		).not.toThrow();
		expect(() => createLiveAdapter(TEST_SESSION, { baseUrl: "http://[::1]:3000" })).not.toThrow();
	});
});

async function fixture(name: string): Promise<unknown> {
	return Bun.file(new URL(name, FIXTURE_DIR)).json();
}

function jsonResponse(value: unknown): Response {
	return Response.json(value);
}

function makeRequest(input: string | URL | Request, init?: RequestInit): Request {
	return input instanceof Request ? new Request(input, init) : new Request(input.toString(), init);
}
