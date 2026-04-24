import type { BeliAdapter } from "@adapters/private-mobile/contract.ts";
import type { Session, SessionStore } from "@core/session.ts";
import type { Command } from "commander";
import { FEED_ITEM_COLUMNS, USER_COLUMNS } from "../columns.ts";
import type { RunContext } from "../context.ts";
import { resolveContext } from "../flags.ts";
import { printPaginatedTable } from "../output.ts";
import { addPaginationOptions, extractPagination } from "../pagination.ts";
import { asOutputRecord, flattenFeedItem, flattenUser, mapPaginated } from "../presenters.ts";
import { runCommand } from "../run.ts";
import { requireSession, validateSession } from "../session.ts";

type AdapterFactory = (session: Session) => BeliAdapter;

export interface SocialCommandDeps {
	readonly createAdapter?: AdapterFactory;
	readonly createSessionStore?: () => SessionStore;
}

/** Register the `beli social` command group. */
export function registerSocialCommand(
	program: Command,
	defaultAdapter: AdapterFactory,
	defaultSessionStore: () => SessionStore,
	deps: SocialCommandDeps = {},
): void {
	const createAdapter = deps.createAdapter ?? defaultAdapter;
	const createStore = deps.createSessionStore ?? defaultSessionStore;
	const social = program.command("social").description("View social feed and connections");

	addPaginationOptions(social.command("feed").description("View your social feed")).action(
		async (cmdOpts: Record<string, unknown>) => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) => executeFeed(c, createAdapter, createStore(), cmdOpts));
		},
	);

	addPaginationOptions(social.command("followers").description("List your followers")).action(
		async (cmdOpts: Record<string, unknown>) => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) => executeFollowers(c, createAdapter, createStore(), cmdOpts));
		},
	);

	addPaginationOptions(social.command("following").description("List who you follow")).action(
		async (cmdOpts: Record<string, unknown>) => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) => executeFollowing(c, createAdapter, createStore(), cmdOpts));
		},
	);
}

async function executeFeed(
	ctx: RunContext,
	createAdapter: AdapterFactory,
	store: SessionStore,
	cmdOpts: Record<string, unknown>,
): Promise<void> {
	const pagination = extractPagination(cmdOpts);
	const session = await requireSession(store, ctx.profile);
	const adapter = createAdapter(session);
	await validateSession(() => adapter.validateSession());
	const result = await adapter.getFeed(pagination);
	printPaginatedTable(
		mapPaginated(result, flattenFeedItem),
		FEED_ITEM_COLUMNS,
		ctx,
		mapPaginated(result, asOutputRecord),
	);
}

async function executeFollowers(
	ctx: RunContext,
	createAdapter: AdapterFactory,
	store: SessionStore,
	cmdOpts: Record<string, unknown>,
): Promise<void> {
	const pagination = extractPagination(cmdOpts);
	const session = await requireSession(store, ctx.profile);
	const adapter = createAdapter(session);
	await validateSession(() => adapter.validateSession());
	const result = await adapter.getFollowers(pagination);
	printPaginatedTable(
		mapPaginated(result, flattenUser),
		USER_COLUMNS,
		ctx,
		mapPaginated(result, asOutputRecord),
	);
}

async function executeFollowing(
	ctx: RunContext,
	createAdapter: AdapterFactory,
	store: SessionStore,
	cmdOpts: Record<string, unknown>,
): Promise<void> {
	const pagination = extractPagination(cmdOpts);
	const session = await requireSession(store, ctx.profile);
	const adapter = createAdapter(session);
	await validateSession(() => adapter.validateSession());
	const result = await adapter.getFollowing(pagination);
	printPaginatedTable(
		mapPaginated(result, flattenUser),
		USER_COLUMNS,
		ctx,
		mapPaginated(result, asOutputRecord),
	);
}
