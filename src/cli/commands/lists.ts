import type { BeliAdapter } from "@adapters/private-mobile/contract.ts";
import type { Session, SessionStore } from "@core/session.ts";
import { entityId } from "@core/types.ts";
import type { Command } from "commander";
import { LIST_COLUMNS } from "../columns.ts";
import type { RunContext } from "../context.ts";
import { resolveContext } from "../flags.ts";
import { printDetail, printPaginatedTable } from "../output.ts";
import { addPaginationOptions, extractPagination } from "../pagination.ts";
import { asOutputRecord, flattenList, mapPaginated } from "../presenters.ts";
import { runCommand } from "../run.ts";
import { requireSession, validateSession } from "../session.ts";

type AdapterFactory = (session: Session) => BeliAdapter;

export interface ListsCommandDeps {
	readonly createAdapter?: AdapterFactory;
	readonly createSessionStore?: () => SessionStore;
}

/** Register the `beli lists` command group. */
export function registerListsCommand(
	program: Command,
	defaultAdapter: AdapterFactory,
	defaultSessionStore: () => SessionStore,
	deps: ListsCommandDeps = {},
): void {
	const createAdapter = deps.createAdapter ?? defaultAdapter;
	const createStore = deps.createSessionStore ?? defaultSessionStore;
	const lists = program.command("lists").description("View your restaurant lists");

	addPaginationOptions(lists.command("ls").description("List all your lists")).action(
		async (cmdOpts: Record<string, unknown>) => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) => executeLs(c, createAdapter, createStore(), cmdOpts));
		},
	);

	lists
		.command("get <id>")
		.description("Get list details by ID")
		.action(async (id: string) => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) => executeGet(c, createAdapter, createStore(), id));
		});
}

async function executeLs(
	ctx: RunContext,
	createAdapter: AdapterFactory,
	store: SessionStore,
	cmdOpts: Record<string, unknown>,
): Promise<void> {
	const pagination = extractPagination(cmdOpts);
	const session = await requireSession(store, ctx.profile);
	const adapter = createAdapter(session);
	await validateSession(() => adapter.validateSession());
	const result = await adapter.getLists(pagination);
	printPaginatedTable(
		mapPaginated(result, flattenList),
		LIST_COLUMNS,
		ctx,
		mapPaginated(result, asOutputRecord),
	);
}

async function executeGet(
	ctx: RunContext,
	createAdapter: AdapterFactory,
	store: SessionStore,
	id: string,
): Promise<void> {
	const session = await requireSession(store, ctx.profile);
	const adapter = createAdapter(session);
	await validateSession(() => adapter.validateSession());
	const list = await adapter.getList(entityId<"List">(id));
	printDetail(flattenList(list), ctx, asOutputRecord(list));
}
