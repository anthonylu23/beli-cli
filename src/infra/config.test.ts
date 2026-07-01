import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ValidationError } from "@core/errors.ts";
import { createConfigStore } from "./config.ts";
import type { ConfigStore, ProfileConfig } from "./config.ts";

let dir: string;
let store: ConfigStore;

const testProfile: ProfileConfig = {
	userId: "user_123",
	username: "testuser",
	displayName: "Test User",
	bootstrappedAt: "2025-04-07T10:00:00.000Z",
	lastValidatedAt: "2025-04-07T10:00:00.000Z",
};

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "beli-cli-test-"));
	store = createConfigStore(dir);
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe("ConfigStore", () => {
	it("returns empty config when file does not exist", async () => {
		const config = await store.load();
		expect(config).toEqual({ profiles: {} });
	});

	it("returns null for nonexistent profile", async () => {
		const profile = await store.getProfile("default");
		expect(profile).toBeNull();
	});

	it("saves and loads a profile", async () => {
		await store.setProfile("default", testProfile);

		const loaded = await store.getProfile("default");
		expect(loaded).toEqual(testProfile);
	});

	it("preserves other profiles when setting one", async () => {
		await store.setProfile("default", testProfile);
		await store.setProfile("work", { ...testProfile, userId: "user_456" });

		const def = await store.getProfile("default");
		const work = await store.getProfile("work");
		expect(def?.userId).toBe("user_123");
		expect(work?.userId).toBe("user_456");
	});

	it("deletes a profile", async () => {
		await store.setProfile("default", testProfile);
		const deleted = await store.deleteProfile("default");

		expect(deleted).toBeTrue();
		expect(await store.getProfile("default")).toBeNull();
	});

	it("returns false when deleting nonexistent profile", async () => {
		const deleted = await store.deleteProfile("nonexistent");
		expect(deleted).toBeFalse();
	});

	it("throws for malformed config files", async () => {
		const filePath = join(dir, "config.json");
		await Bun.write(filePath, "not json");

		await expect(store.load()).rejects.toThrow(ValidationError);
		await expect(store.load()).rejects.toThrow(filePath);
	});

	it("throws for config files with the wrong top-level shape", async () => {
		const filePath = join(dir, "config.json");
		await Bun.write(filePath, JSON.stringify({ profiles: [] }));

		await expect(store.load()).rejects.toThrow(ValidationError);
	});

	for (const [label, profile] of [
		["missing fields", { userId: null }],
		["wrong field types", { ...testProfile, username: 42 }],
		["invalid timestamps", { ...testProfile, bootstrappedAt: "yesterday" }],
		["empty user id", { ...testProfile, userId: "" }],
		["invalid user id", { ...testProfile, userId: "user 123" }],
	] as const) {
		it(`throws for well-formed config JSON with ${label}`, async () => {
			await Bun.write(join(dir, "config.json"), JSON.stringify({ profiles: { default: profile } }));
			await expect(store.load()).rejects.toThrow(ValidationError);
		});
	}

	it("does not treat inherited profile names as stored profiles", async () => {
		expect(await store.getProfile("toString")).toBeNull();
		expect(await store.deleteProfile("toString")).toBeFalse();
	});

	it("does not overwrite malformed config files when setting a profile", async () => {
		const filePath = join(dir, "config.json");
		await Bun.write(filePath, "not json");

		await expect(store.setProfile("default", testProfile)).rejects.toThrow(ValidationError);
		expect(await readFile(filePath, "utf8")).toBe("not json");
	});

	it("creates config directory on first write", async () => {
		const nested = join(dir, "nested", "deep");
		const nestedStore = createConfigStore(nested);
		await nestedStore.setProfile("default", testProfile);

		const loaded = await nestedStore.getProfile("default");
		expect(loaded).toEqual(testProfile);
	});

	it("preserves null user ids for partially identified sessions", async () => {
		await store.setProfile("default", { ...testProfile, userId: null });

		const loaded = await store.getProfile("default");
		expect(loaded?.userId).toBeNull();
	});
});
