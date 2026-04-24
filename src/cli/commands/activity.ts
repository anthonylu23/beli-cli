import type { BeliAdapter } from "@adapters/private-mobile/contract.ts";
import type { Session, SessionStore } from "@core/session.ts";
import { entityId } from "@core/types.ts";
import type { Command } from "commander";
import { FEED_ITEM_COLUMNS } from "../columns.ts";
import type { RunContext } from "../context.ts";
import { resolveContext } from "../flags.ts";
import { printPaginatedTable } from "../output.ts";
import { addPaginationOptions, extractPagination } from "../pagination.ts";
import { asOutputRecord, flattenFeedItem, mapPaginated } from "../presenters.ts";
import { runCommand } from "../run.ts";
import { requireSession, validateSession } from "../session.ts";

type AdapterFactory = (session: Session) => BeliAdapter;

export interface ActivityCommandDeps {
	readonly createAdapter?: AdapterFactory;
	readonly createSessionStore?: () => SessionStore;
}

/** Register the `beli activity` command group. */
export function registerActivityCommand(
	program: Command,
	defaultAdapter: AdapterFactory,
	defaultSessionStore: () => SessionStore,
	deps: ActivityCommandDeps = {},
): void {
	const createAdapter = deps.createAdapter ?? defaultAdapter;
	const createStore = deps.createSessionStore ?? defaultSessionStore;
	const activity = program.command("activity").description("View user activity");

	addPaginationOptions(
		activity
			.command("list")
			.description("List your recent activity")
			.option("--user <userId>", "View activity for a specific user"),
	).action(async (cmdOpts: Record<string, unknown>) => {
		const ctx = resolveContext(program.opts() as Record<string, unknown>);
		await runCommand(ctx, (c) => executeList(c, createAdapter, createStore(), cmdOpts));
	});
}

async function executeList(
	ctx: RunContext,
	createAdapter: AdapterFactory,
	store: SessionStore,
	cmdOpts: Record<string, unknown>,
): Promise<void> {
	const pagination = extractPagination(cmdOpts);
	const session = await requireSession(store, ctx.profile);
	const adapter = createAdapter(session);
	await validateSession(() => adapter.validateSession());

	// Resolve userId: explicit --user flag, session userId, or fetch from getMe()
	let userId: string;
	if (typeof cmdOpts.user === "string") {
		userId = cmdOpts.user;
	} else if (session.credentials.userId) {
		userId = session.credentials.userId;
	} else {
		const me = await adapter.getMe();
		userId = me.id;
	}

	const result = await adapter.getUserActivity(entityId<"User">(userId), pagination);
	printPaginatedTable(
		mapPaginated(result, flattenFeedItem),
		FEED_ITEM_COLUMNS,
		ctx,
		mapPaginated(result, asOutputRecord),
	);
}
