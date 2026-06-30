import { parseSessionCredentials } from "@core/session.ts";
import type { Session, SessionStore } from "@core/session.ts";
import { entityId, timestamp } from "@core/types.ts";
import { isProfileConfig } from "./config.ts";
import type { ConfigStore } from "./config.ts";
import type { KeychainStore } from "./keychain.ts";

/** Create a SessionStore that combines Keychain (secrets) + ConfigStore (metadata). */
export function createSessionStore(keychain: KeychainStore, config: ConfigStore): SessionStore {
	return {
		async load(profile: string): Promise<Session | null> {
			const [credentialsJson, metadata] = await Promise.all([
				keychain.get(profile),
				config.getProfile(profile),
			]);

			if (!credentialsJson || !metadata) return null;

			let parsed: unknown;
			try {
				parsed = JSON.parse(credentialsJson);
			} catch {
				return null;
			}
			const credentials = parseSessionCredentials(parsed);
			if (!credentials || !isProfileConfig(metadata)) return null;

			try {
				return {
					credentials,
					metadata: {
						...metadata,
						profile,
						userId: metadata.userId === null ? null : entityId<"User">(metadata.userId),
						bootstrappedAt: timestamp(metadata.bootstrappedAt),
						lastValidatedAt: timestamp(metadata.lastValidatedAt),
					},
				};
			} catch {
				return null;
			}
		},

		async save(profile: string, session: Session): Promise<void> {
			if (profile !== session.metadata.profile) {
				throw new TypeError("Session profile does not match the target profile");
			}
			if (!parseSessionCredentials(session.credentials)) {
				throw new TypeError("Session credentials are invalid");
			}
			const credentialsJson = JSON.stringify(session.credentials);
			const previousMetadata = await config.getProfile(profile);

			await config.setProfile(profile, {
				userId: session.metadata.userId,
				username: session.metadata.username,
				displayName: session.metadata.displayName,
				bootstrappedAt: session.metadata.bootstrappedAt,
				lastValidatedAt: session.metadata.lastValidatedAt,
			});

			try {
				await keychain.set(profile, credentialsJson);
			} catch (error) {
				if (previousMetadata) {
					await config.setProfile(profile, previousMetadata);
				} else {
					await config.deleteProfile(profile);
				}
				throw error;
			}
		},

		async delete(profile: string): Promise<void> {
			const previousMetadata = await config.getProfile(profile);
			await config.deleteProfile(profile);
			try {
				await keychain.delete(profile);
			} catch (error) {
				if (previousMetadata) {
					try {
						await config.setProfile(profile, previousMetadata);
					} catch (rollbackError) {
						throw new AggregateError(
							[error, rollbackError],
							"Session deletion failed and config rollback also failed",
						);
					}
				}
				throw error;
			}
		},

		async exists(profile: string): Promise<boolean> {
			return (await this.load(profile)) !== null;
		},
	};
}
