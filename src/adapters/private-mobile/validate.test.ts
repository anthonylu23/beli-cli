import { describe, expect, it } from "bun:test";
import { validateToken } from "./validate.ts";

describe("validateToken (stub)", () => {
	it("returns valid: true for any token", async () => {
		const result = await validateToken("any-token");
		expect(result.valid).toBeTrue();
	});

	it("returns user info when userId is provided", async () => {
		const result = await validateToken("any-token", "user_123");
		expect(result.valid).toBeTrue();
		expect(result.user?.id).toBe("user_123");
	});

	it("returns no user info when userId is omitted", async () => {
		const result = await validateToken("any-token");
		expect(result.user).toBeUndefined();
	});
});
