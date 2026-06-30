import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ValidationError } from "@core/errors.ts";
import { timestamp } from "@core/types.ts";

/** Per-profile config stored on disk (no secrets). */
export interface ProfileConfig {
	readonly userId: string | null;
	readonly username: string | null;
	readonly displayName: string | null;
	readonly bootstrappedAt: string;
	readonly lastValidatedAt: string;
}

/** Top-level config file shape. */
export interface ConfigFile {
	readonly profiles: Record<string, ProfileConfig>;
}

/** Manages the beli-cli config file. */
export interface ConfigStore {
	/** Load the full config file. Returns empty config if file doesn't exist. */
	load(): Promise<ConfigFile>;

	/** Overwrite the entire config file. */
	save(config: ConfigFile): Promise<void>;

	/** Get a single profile's config. Returns null if not found. */
	getProfile(profile: string): Promise<ProfileConfig | null>;

	/** Set a single profile's config (merges into existing file). */
	setProfile(profile: string, data: ProfileConfig): Promise<void>;

	/** Delete a single profile's config. Returns true if deleted. */
	deleteProfile(profile: string): Promise<boolean>;
}

const DEFAULT_CONFIG: ConfigFile = { profiles: {} };

function defaultConfigDir(): string {
	const home = process.env.HOME ?? Bun.env.HOME ?? "";
	return join(home, ".config", "beli-cli");
}

export function createConfigStore(configDir?: string): ConfigStore {
	const dir = configDir ?? defaultConfigDir();
	const filePath = join(dir, "config.json");

	async function load(): Promise<ConfigFile> {
		const file = Bun.file(filePath);
		if (!(await file.exists())) return DEFAULT_CONFIG;

		let raw: unknown;
		try {
			raw = await file.json();
		} catch {
			throw invalidConfigError(filePath);
		}

		if (!isConfigFile(raw)) {
			throw invalidConfigError(filePath);
		}

		return raw;
	}

	async function save(config: ConfigFile): Promise<void> {
		if (!isConfigFile(config)) throw invalidConfigError(filePath);
		await mkdir(dir, { recursive: true });

		// Atomic write: write to temp then rename
		const tmpPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
		const content = JSON.stringify(config, null, "\t");
		try {
			await writeFile(tmpPath, `${content}\n`, { mode: 0o600 });
			await rename(tmpPath, filePath);
		} catch (error) {
			await rm(tmpPath, { force: true }).catch(() => undefined);
			throw error;
		}
	}

	return {
		load,
		save,

		async getProfile(profile: string): Promise<ProfileConfig | null> {
			const config = await load();
			return config.profiles[profile] ?? null;
		},

		async setProfile(profile: string, data: ProfileConfig): Promise<void> {
			const config = await load();
			await save({
				...config,
				profiles: { ...config.profiles, [profile]: data },
			});
		},

		async deleteProfile(profile: string): Promise<boolean> {
			const config = await load();
			if (!Object.hasOwn(config.profiles, profile)) return false;

			const { [profile]: _, ...rest } = config.profiles;
			await save({ ...config, profiles: rest });
			return true;
		},
	};
}

function invalidConfigError(filePath: string): ValidationError {
	return new ValidationError(
		`Config file at ${filePath} is invalid. Repair or remove it before continuing.`,
		"config",
	);
}

function isConfigFile(value: unknown): value is ConfigFile {
	if (!isRecord(value)) return false;
	if (!isRecord(value.profiles)) return false;
	return Object.entries(value.profiles).every(
		([profile, data]) => isProfileName(profile) && isProfileConfig(data),
	);
}

export function isProfileConfig(value: unknown): value is ProfileConfig {
	if (!isRecord(value)) return false;
	return (
		isNullableString(value.userId, false) &&
		isNullableString(value.username, true) &&
		isNullableString(value.displayName, true) &&
		isValidTimestamp(value.bootstrappedAt) &&
		isValidTimestamp(value.lastValidatedAt)
	);
}

function isProfileName(value: string): boolean {
	return (
		value.trim() === value &&
		value.length > 0 &&
		![...value].some((character) => {
			const codePoint = character.codePointAt(0) ?? 0;
			return codePoint <= 31 || codePoint === 127;
		})
	);
}

function isNullableString(value: unknown, allowEmpty: boolean): boolean {
	return (
		value === null ||
		(typeof value === "string" && (allowEmpty || value.length > 0) && value.trim() === value)
	);
}

function isValidTimestamp(value: unknown): boolean {
	if (typeof value !== "string") return false;
	try {
		timestamp(value);
		return true;
	} catch {
		return false;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
