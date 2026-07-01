#!/usr/bin/env bun

import { createDefaultAdapterFactory, resolveAdapterMode } from "@cli/adapter.ts";
import { AuthRequiredError, BeliError, ValidationError } from "@core/errors.ts";
import { entityId } from "@core/types.ts";
import { createConfigStore } from "@infra/config.ts";
import { createKeychainStore } from "@infra/keychain.ts";
import { createSessionStore } from "@infra/session-store.ts";

function readSmokeOptions(): { query: string; profile: string } {
	if (Bun.env.BELI_LIVE_SMOKE !== "1") {
		throw new ValidationError("Set BELI_LIVE_SMOKE=1 to run the live smoke flow.");
	}
	if (resolveAdapterMode(Bun.env) !== "live") {
		throw new ValidationError("Set BELI_ADAPTER=live to run the live smoke flow.");
	}

	const query = Bun.env.BELI_SMOKE_RESTAURANT_QUERY?.trim();
	if (!query) {
		throw new ValidationError("Set BELI_SMOKE_RESTAURANT_QUERY to a known safe query.");
	}
	return { query, profile: Bun.env.BELI_PROFILE?.trim() || "default" };
}

async function main(): Promise<void> {
	const { query, profile } = readSmokeOptions();
	const store = createSessionStore(createKeychainStore(), createConfigStore());
	const session = await store.load(profile);
	if (!session) {
		throw new AuthRequiredError(
			`No session found for profile "${profile}". Run beli auth bootstrap.`,
		);
	}

	const adapter = createDefaultAdapterFactory(Bun.env)(session);
	if (!(await adapter.validateSession())) {
		throw new AuthRequiredError("Stored session is not valid. Run beli auth bootstrap.");
	}

	const restaurants = await adapter.searchRestaurants({ query, limit: 1 });
	const restaurant = restaurants.items[0];
	if (!restaurant) {
		throw new ValidationError(`No restaurants found for BELI_SMOKE_RESTAURANT_QUERY="${query}".`);
	}

	let createdListId: string | null = null;
	let removedEntry = false;
	let primaryError: unknown;

	try {
		const list = await adapter.createList({
			name: `beli-cli Smoke Test ${new Date().toISOString()}`,
			description: "Created by beli-cli live smoke test",
			visibility: "private",
		});
		createdListId = list.id;

		await adapter.addListEntry(list.id, {
			restaurantId: restaurant.id,
			notes: "beli-cli live smoke test",
		});

		const readback = await adapter.getList(list.id);
		if (!readback.entries.some((entry) => entry.restaurantId === restaurant.id)) {
			throw new Error("Smoke list readback did not include the added restaurant.");
		}

		await adapter.removeListEntry(list.id, restaurant.id);
		removedEntry = true;

		process.stdout.write(
			`${JSON.stringify(
				{
					ok: true,
					profile,
					restaurantId: restaurant.id,
					listId: list.id,
					removedEntry,
				},
				null,
				2,
			)}\n`,
		);
	} catch (error) {
		primaryError = error;
	}

	if (createdListId) {
		try {
			await adapter.deleteList(entityId<"List">(createdListId));
		} catch (cleanupError) {
			if (primaryError === undefined) throw cleanupError;
			const message =
				cleanupError instanceof Error ? cleanupError.message : "unknown cleanup error";
			process.stderr.write(`warning: smoke cleanup also failed: ${message}\n`);
		}
	}
	if (primaryError !== undefined) throw primaryError;
}

try {
	await main();
} catch (error) {
	if (error instanceof BeliError) {
		process.stderr.write(`error: ${error.message}\n`);
		process.exit(error.code);
	}
	const message = error instanceof Error ? error.message : "Live smoke failed.";
	process.stderr.write(`error: ${message}\n`);
	process.exit(1);
}
