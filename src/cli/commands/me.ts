import type { BeliAdapter } from "@adapters/private-mobile/contract.ts";
import type { Session, SessionStore } from "@core/session.ts";
import type { Command } from "commander";
import type { RunContext } from "../context.ts";
import { resolveContext } from "../flags.ts";
import { printDetail } from "../output.ts";
import { asOutputRecord, flattenUser } from "../presenters.ts";
import { runCommand } from "../run.ts";
import { requireSession, validateSession } from "../session.ts";

type AdapterFactory = (session: Session) => BeliAdapter;

export interface MeCommandDeps {
	readonly createAdapter?: AdapterFactory;
	readonly createSessionStore?: () => SessionStore;
}

/** Register the `beli me` command group. */
export function registerMeCommand(
	program: Command,
	defaultAdapter: AdapterFactory,
	defaultSessionStore: () => SessionStore,
	deps: MeCommandDeps = {},
): void {
	const createAdapter = deps.createAdapter ?? defaultAdapter;
	const createStore = deps.createSessionStore ?? defaultSessionStore;
	const me = program.command("me").description("View your profile and stats");

	me.command("profile")
		.description("Show your profile")
		.action(async () => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) => executeProfile(c, createAdapter, createStore()));
		});

	me.command("stats")
		.description("Show your stats")
		.action(async () => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) => executeStats(c, createAdapter, createStore()));
		});
}

async function executeProfile(
	ctx: RunContext,
	createAdapter: AdapterFactory,
	store: SessionStore,
): Promise<void> {
	const session = await requireSession(store, ctx.profile);
	const adapter = createAdapter(session);
	await validateSession(() => adapter.validateSession());
	const user = await adapter.getMe();
	printDetail(flattenUser(user), ctx, asOutputRecord(user));
}

async function executeStats(
	ctx: RunContext,
	createAdapter: AdapterFactory,
	store: SessionStore,
): Promise<void> {
	const session = await requireSession(store, ctx.profile);
	const adapter = createAdapter(session);
	await validateSession(() => adapter.validateSession());
	const user = await adapter.getMe();

	if (!user.stats) {
		printDetail({ message: "No stats available" }, ctx);
		return;
	}

	printDetail(
		{
			totalRatings: user.stats.totalRatings,
			totalReviews: user.stats.totalReviews,
			totalLists: user.stats.totalLists,
			followerCount: user.stats.followerCount,
			followingCount: user.stats.followingCount,
		},
		ctx,
	);
}
