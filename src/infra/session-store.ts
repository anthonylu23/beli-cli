import type { Session, SessionCredentials, SessionStore } from "@core/session.ts";
import { timestamp } from "@core/types.ts";
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

			let credentials: SessionCredentials;
			try {
				credentials = JSON.parse(credentialsJson) as SessionCredentials;
			} catch {
				return null;
			}

			return {
				credentials,
				metadata: {
					...metadata,
					profile,
					bootstrappedAt: timestamp(metadata.bootstrappedAt),
					lastValidatedAt: timestamp(metadata.lastValidatedAt),
				},
			};
		},

		async save(profile: string, session: Session): Promise<void> {
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
			await Promise.all([keychain.delete(profile), config.deleteProfile(profile)]);
		},

		async exists(profile: string): Promise<boolean> {
			const result = await keychain.get(profile);
			return result !== null;
		},
	};
}
