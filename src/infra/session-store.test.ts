import { beforeEach, describe, expect, it } from "bun:test";
import type { Session } from "@core/session.ts";
import { timestamp } from "@core/types.ts";
import type { ConfigStore, ProfileConfig } from "./config.ts";
import type { KeychainStore } from "./keychain.ts";
import { createSessionStore } from "./session-store.ts";

const now = timestamp("2025-04-07T10:00:00.000Z");

const testCredentials = {
	authToken: "tok_abc",
	refreshToken: null,
	userId: "user_123",
};

const testMetadata: ProfileConfig = {
	userId: "user_123",
	username: "testuser",
	displayName: "Test User",
	bootstrappedAt: "2025-04-07T10:00:00.000Z",
	lastValidatedAt: "2025-04-07T10:00:00.000Z",
};

function mockKeychain(): KeychainStore & { data: Map<string, string> } {
	const data = new Map<string, string>();
	return {
		data,
		async get(account) {
			return data.get(account) ?? null;
		},
		async set(account, password) {
			data.set(account, password);
		},
		async delete(account) {
			return data.delete(account);
		},
	};
}

function mockConfig(): ConfigStore & { profiles: Map<string, ProfileConfig> } {
	const profiles = new Map<string, ProfileConfig>();
	return {
		profiles,
		async load() {
			return { profiles: Object.fromEntries(profiles) };
		},
		async save(config) {
			profiles.clear();
			for (const [k, v] of Object.entries(config.profiles)) {
				profiles.set(k, v);
			}
		},
		async getProfile(profile) {
			return profiles.get(profile) ?? null;
		},
		async setProfile(profile, data) {
			profiles.set(profile, data);
		},
		async deleteProfile(profile) {
			return profiles.delete(profile);
		},
	};
}

describe("SessionStore", () => {
	let keychain: ReturnType<typeof mockKeychain>;
	let config: ReturnType<typeof mockConfig>;
	let store: ReturnType<typeof createSessionStore>;

	const testSession: Session = {
		credentials: testCredentials,
		metadata: {
			profile: "default",
			userId: "user_123",
			username: "testuser",
			displayName: "Test User",
			bootstrappedAt: now,
			lastValidatedAt: now,
		},
	};

	beforeEach(() => {
		keychain = mockKeychain();
		config = mockConfig();
		store = createSessionStore(keychain, config);
	});

	it("returns null when no session exists", async () => {
		const session = await store.load("default");
		expect(session).toBeNull();
	});

	it("returns null when keychain has data but config does not", async () => {
		keychain.data.set("default", JSON.stringify(testCredentials));
		const session = await store.load("default");
		expect(session).toBeNull();
	});

	it("returns null when config has data but keychain does not", async () => {
		config.profiles.set("default", testMetadata);
		const session = await store.load("default");
		expect(session).toBeNull();
	});

	it("loads a session when both stores have data", async () => {
		keychain.data.set("default", JSON.stringify(testCredentials));
		config.profiles.set("default", testMetadata);

		const session = await store.load("default");
		expect(session).not.toBeNull();
		expect(session?.credentials.authToken).toBe("tok_abc");
		expect(session?.metadata.username).toBe("testuser");
		expect(session?.metadata.profile).toBe("default");
	});

	it("saves credentials to keychain and metadata to config", async () => {
		await store.save("default", testSession);

		expect(keychain.data.has("default")).toBeTrue();
		expect(config.profiles.has("default")).toBeTrue();

		const creds = JSON.parse(keychain.data.get("default") ?? "");
		expect(creds.authToken).toBe("tok_abc");
		expect(config.profiles.get("default")?.userId).toBe("user_123");
	});

	it("deletes from both stores", async () => {
		await store.save("default", testSession);
		await store.delete("default");

		expect(keychain.data.has("default")).toBeFalse();
		expect(config.profiles.has("default")).toBeFalse();
	});

	it("exists returns true when keychain has data", async () => {
		keychain.data.set("default", "{}");
		expect(await store.exists("default")).toBeTrue();
	});

	it("exists returns false when keychain is empty", async () => {
		expect(await store.exists("default")).toBeFalse();
	});

	it("returns null for malformed keychain JSON", async () => {
		keychain.data.set("default", "not-json");
		config.profiles.set("default", testMetadata);

		const session = await store.load("default");
		expect(session).toBeNull();
	});

	it("preserves null user ids across save and load", async () => {
		const sessionWithUnknownIdentity: Session = {
			credentials: {
				authToken: "tok_unknown",
				refreshToken: null,
				userId: null,
			},
			metadata: {
				profile: "default",
				userId: null,
				username: null,
				displayName: null,
				bootstrappedAt: now,
				lastValidatedAt: now,
			},
		};

		await store.save("default", sessionWithUnknownIdentity);
		const loaded = await store.load("default");

		expect(loaded?.credentials.userId).toBeNull();
		expect(loaded?.metadata.userId).toBeNull();
	});
});
