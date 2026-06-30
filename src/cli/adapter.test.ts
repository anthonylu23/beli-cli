import { describe, expect, test } from "bun:test";
import { ValidationError } from "@core/errors.ts";
import { createDefaultAdapterFactory, requireLiveBaseUrl, resolveAdapterMode } from "./adapter.ts";
import { TEST_SESSION } from "./test-helpers.ts";

describe("adapter selection", () => {
	test("uses the stub adapter by default", async () => {
		const factory = createDefaultAdapterFactory({});
		const adapter = factory(TEST_SESSION);

		await expect(adapter.validateSession()).resolves.toBe(true);
		await expect(adapter.getMe()).resolves.toMatchObject({ id: "user_001" });
	});

	test("requires an explicit base URL for live mode", () => {
		expect(resolveAdapterMode({ BELI_ADAPTER: "live" })).toBe("live");
		expect(() => requireLiveBaseUrl({ BELI_ADAPTER: "live" })).toThrow(ValidationError);
		expect(() => createDefaultAdapterFactory({ BELI_ADAPTER: "other" })(TEST_SESSION)).toThrow(
			ValidationError,
		);
	});

	test("creates a live adapter only when BELI_ADAPTER=live", async () => {
		const requests: Request[] = [];
		const factory = createDefaultAdapterFactory(
			{
				BELI_ADAPTER: "live",
				BELI_API_BASE_URL: "https://fixture.local",
			},
			async (input, init) => {
				requests.push(makeRequest(input, init));
				return Response.json({
					user: {
						id: "user_live",
						username: "live",
						display_name: "Live User",
						avatar_url: null,
						bio: null,
						stats: null,
						created_at: null,
					},
				});
			},
		);

		const adapter = factory(TEST_SESSION);
		await expect(adapter.getMe()).resolves.toMatchObject({ id: "user_live" });
		expect(requests[0]?.url).toBe("https://fixture.local/me");
	});
});

function makeRequest(input: string | URL | Request, init?: RequestInit): Request {
	return input instanceof Request ? new Request(input, init) : new Request(input.toString(), init);
}
