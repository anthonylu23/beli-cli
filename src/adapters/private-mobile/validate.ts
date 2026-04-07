/** Result of token validation. */
export interface ValidationResult {
	readonly valid: boolean;
	readonly user?:
		| {
				readonly id: string;
				readonly username: string;
				readonly displayName: string;
		  }
		| undefined;
}

/**
 * Validate an auth token against the Beli API.
 *
 * Stubbed: always returns { valid: true }.
 * Will be replaced with a real HTTP call once API endpoints are
 * discovered by capturing mobile app traffic via an HTTP proxy.
 */
export async function validateToken(
	_authToken: string,
	userId?: string,
): Promise<ValidationResult> {
	// TODO: Replace with real API call when endpoints are mapped.
	return {
		valid: true,
		user: userId ? { id: userId, username: "", displayName: "" } : undefined,
	};
}
