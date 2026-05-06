#!/usr/bin/env bun

import type { BeliAdapter } from "@adapters/private-mobile/contract.ts";
import { createStubAdapter } from "@adapters/private-mobile/stub.ts";
import type { Session, SessionStore } from "@core/session.ts";
import { createConfigStore } from "@infra/config.ts";
import { createKeychainStore } from "@infra/keychain.ts";
import { createSessionStore } from "@infra/session-store.ts";
import { Command } from "commander";
import { registerActivityCommand } from "./commands/activity.ts";
import { registerAuthCommand } from "./commands/auth.ts";
import { registerListsCommand } from "./commands/lists.ts";
import { registerMeCommand } from "./commands/me.ts";
import { registerRatingsCommand } from "./commands/ratings.ts";
import { registerRawCommand } from "./commands/raw.ts";
import { registerRestaurantsCommand } from "./commands/restaurants.ts";
import { registerReviewsCommand } from "./commands/reviews.ts";
import { registerSocialCommand } from "./commands/social.ts";
import { addGlobalFlags } from "./flags.ts";
import { VERSION } from "./version.ts";

export { VERSION } from "./version.ts";

type AuthCommandOptions = Parameters<typeof registerAuthCommand>[1];
type ListsCommandOptions = Parameters<typeof registerListsCommand>[3];
type RatingsCommandOptions = Parameters<typeof registerRatingsCommand>[3];
type ReviewsCommandOptions = Parameters<typeof registerReviewsCommand>[3];
export type AdapterFactory = (session: Session) => BeliAdapter;

export interface ProgramOptions {
	readonly auth?: AuthCommandOptions;
	readonly lists?: ListsCommandOptions;
	readonly ratings?: RatingsCommandOptions;
	readonly reviews?: ReviewsCommandOptions;
	readonly createAdapter?: AdapterFactory;
	readonly createSessionStore?: () => SessionStore;
}

function buildSessionStore(): SessionStore {
	return createSessionStore(createKeychainStore(), createConfigStore());
}

export function createProgram(options: ProgramOptions = {}): Command {
	const program = new Command()
		.name("beli")
		.version(VERSION, "-V, --version", "Print version")
		.description("Beli restaurant CLI");

	addGlobalFlags(program);

	const createAdapter = options.createAdapter ?? (() => createStubAdapter());
	const createStore = options.createSessionStore ?? buildSessionStore;
	const authOptions: AuthCommandOptions =
		options.auth?.createSessionStore || !options.createSessionStore
			? options.auth
			: { ...options.auth, createSessionStore: createStore };

	registerAuthCommand(program, authOptions);
	registerRawCommand(program);
	registerMeCommand(program, createAdapter, createStore);
	registerRestaurantsCommand(program, createAdapter, createStore);
	registerListsCommand(program, createAdapter, createStore, options.lists);
	registerRatingsCommand(program, createAdapter, createStore, options.ratings);
	registerReviewsCommand(program, createAdapter, createStore, options.reviews);
	registerActivityCommand(program, createAdapter, createStore);
	registerSocialCommand(program, createAdapter, createStore);

	return program;
}

if (import.meta.main) {
	await createProgram().parseAsync(process.argv);
}
