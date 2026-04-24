import { AuthRequiredError } from "@core/errors.ts";
import type { Session, SessionStore } from "@core/session.ts";

/** Load a session or throw AuthRequiredError. Used by Phase 3+ commands. */
export async function requireSession(store: SessionStore, profile: string): Promise<Session> {
	const session = await store.load(profile);
	if (!session) {
		throw new AuthRequiredError(
			`Not authenticated. Run "beli auth bootstrap" to set up a session.`,
		);
	}
	return session;
}

export async function validateSession(isValid: () => Promise<boolean>): Promise<void> {
	if (!(await isValid())) {
		throw new AuthRequiredError(
			`Not authenticated. Run "beli auth bootstrap" to set up a session.`,
		);
	}
}
