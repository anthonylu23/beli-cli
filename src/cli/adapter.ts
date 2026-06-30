import type { BeliAdapter } from "@adapters/private-mobile/contract.ts";
import { createLiveAdapter } from "@adapters/private-mobile/live.ts";
import type { FetchFn } from "@adapters/private-mobile/live.ts";
import { createStubAdapter } from "@adapters/private-mobile/stub.ts";
import { ValidationError } from "@core/errors.ts";
import type { Session } from "@core/session.ts";

export type AdapterFactory = (session: Session) => BeliAdapter;
export type AdapterMode = "stub" | "live";

export type AdapterEnvironment = Readonly<Record<string, string | undefined>>;

export function resolveAdapterMode(env: AdapterEnvironment = process.env): AdapterMode {
	const raw = env.BELI_ADAPTER?.trim();
	if (raw === undefined || raw === "" || raw === "stub") return "stub";
	if (raw === "live") return "live";
	throw new ValidationError("BELI_ADAPTER must be either stub or live", "BELI_ADAPTER");
}

export function createDefaultAdapterFactory(
	env: AdapterEnvironment = process.env,
	fetchFn: FetchFn = fetch,
): AdapterFactory {
	return (session) => {
		const mode = resolveAdapterMode(env);
		if (mode === "stub") return createStubAdapter();

		return createLiveAdapter(session, {
			baseUrl: requireLiveBaseUrl(env),
			fetchFn,
		});
	};
}

export function requireLiveBaseUrl(env: AdapterEnvironment = process.env): string {
	const baseUrl = env.BELI_API_BASE_URL?.trim();
	if (!baseUrl) {
		throw new ValidationError(
			"BELI_API_BASE_URL is required when BELI_ADAPTER=live until captured endpoint notes are configured.",
			"BELI_API_BASE_URL",
		);
	}
	return baseUrl;
}
