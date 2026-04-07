import type { Timestamp } from "./types.ts";

/** Secret credentials stored in the keychain. */
export interface SessionCredentials {
	readonly authToken: string;
	readonly refreshToken: string | null;
	readonly userId: string | null;
}

/** Non-secret session metadata stored in config. */
export interface SessionMetadata {
	readonly profile: string;
	readonly userId: string | null;
	readonly username: string | null;
	readonly displayName: string | null;
	readonly bootstrappedAt: Timestamp;
	readonly lastValidatedAt: Timestamp;
}

/** Full resolved session combining secrets + metadata. */
export interface Session {
	readonly credentials: SessionCredentials;
	readonly metadata: SessionMetadata;
}

/** Bootstrap input — what the user provides during import. */
export interface BootstrapInput {
	readonly authToken: string;
	readonly refreshToken?: string | undefined;
	readonly userId?: string | undefined;
}

/** Contract for session persistence. Core owns this interface; infra implements it. */
export interface SessionStore {
	/** Load a session for the given profile. Returns null if none exists. */
	load(profile: string): Promise<Session | null>;

	/** Save a session (credentials + metadata) for the given profile. */
	save(profile: string, session: Session): Promise<void>;

	/** Delete a session for the given profile. */
	delete(profile: string): Promise<void>;

	/** Check whether a session exists for the given profile. */
	exists(profile: string): Promise<boolean>;
}
