import { describe, expect, it } from "bun:test";
import { createKeychainStore } from "./keychain.ts";

describe("KeychainStore", () => {
	it("passes reads through to the security runner", async () => {
		let capturedArgs: readonly string[] = [];
		const store = createKeychainStore({
			service: "test-service",
			runSecurity: async ({ args }) => {
				capturedArgs = args;
				return { exitCode: 0, stdout: "secret\n", stderr: "" };
			},
		});

		const result = await store.get("default");

		expect(result).toBe("secret");
		expect(capturedArgs).toEqual([
			"find-generic-password",
			"-s",
			"test-service",
			"-a",
			"default",
			"-w",
		]);
	});

	it("writes secrets via stdin instead of argv", async () => {
		let capturedArgs: readonly string[] = [];
		let capturedStdin: string | undefined;
		const store = createKeychainStore({
			service: "test-service",
			runSecurity: async ({ args, stdin }) => {
				capturedArgs = args;
				capturedStdin = stdin;
				return { exitCode: 0, stdout: "", stderr: "" };
			},
		});

		await store.set("default", '{"authToken":"secret"}');

		expect(capturedArgs).toEqual([
			"add-generic-password",
			"-s",
			"test-service",
			"-a",
			"default",
			"-U",
			"-w",
		]);
		expect(capturedStdin).toBe('{"authToken":"secret"}');
		expect(capturedArgs).not.toContain('{"authToken":"secret"}');
	});

	it("returns null when an entry is not found", async () => {
		const store = createKeychainStore({
			runSecurity: async () => ({ exitCode: 44, stdout: "", stderr: "" }),
		});

		expect(await store.get("missing")).toBeNull();
	});

	it("returns false when deleting a missing entry", async () => {
		const store = createKeychainStore({
			runSecurity: async () => ({ exitCode: 44, stdout: "", stderr: "" }),
		});

		expect(await store.delete("missing")).toBeFalse();
	});
});
