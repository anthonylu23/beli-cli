import type { BeliAdapter } from "@adapters/private-mobile/contract.ts";
import { ValidationError } from "@core/errors.ts";
import type { Session, SessionStore } from "@core/session.ts";
import { entityId } from "@core/types.ts";
import type { Command } from "commander";
import { LIST_COLUMNS } from "../columns.ts";
import type { RunContext } from "../context.ts";
import { resolveContext } from "../flags.ts";
import { printDetail, printJson, printPaginatedTable } from "../output.ts";
import { addPaginationOptions, extractPagination } from "../pagination.ts";
import { asOutputRecord, flattenList, mapPaginated } from "../presenters.ts";
import { runCommand } from "../run.ts";
import { requireSession, validateSession } from "../session.ts";
import { readStdinJson } from "../stdin.ts";
import { buildWritePayload, confirmAction as defaultConfirm } from "../write-utils.ts";

type AdapterFactory = (session: Session) => BeliAdapter;

export interface ListsCommandDeps {
	readonly createAdapter?: AdapterFactory;
	readonly createSessionStore?: () => SessionStore;
	readonly readJsonInput?: () => Promise<Record<string, unknown>>;
	readonly confirm?: (question: string) => Promise<boolean>;
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
	const readJsonInput = deps.readJsonInput ?? readStdinJson<Record<string, unknown>>;
	const confirmAction = deps.confirm ?? defaultConfirm;
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

	lists
		.command("create")
		.description("Create a restaurant list")
		.option("--name <name>", "List name")
		.option("--description <description>", "List description")
		.option("--visibility <visibility>", "List visibility: public or private")
		.action(async (cmdOpts: Record<string, unknown>) => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) =>
				executeCreate(c, createAdapter, createStore(), readJsonInput, cmdOpts),
			);
		});

	lists
		.command("update <id>")
		.description("Update a restaurant list")
		.option("--name <name>", "List name")
		.option("--description <description>", "List description")
		.option("--visibility <visibility>", "List visibility: public or private")
		.action(async (id: string, cmdOpts: Record<string, unknown>) => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) =>
				executeUpdate(c, createAdapter, createStore(), readJsonInput, id, cmdOpts),
			);
		});

	lists
		.command("delete <id>")
		.description("Delete a restaurant list")
		.option("--yes", "Skip confirmation prompt", false)
		.action(async (id: string, cmdOpts: Record<string, unknown>) => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) =>
				executeDelete(c, createAdapter, createStore(), confirmAction, id, cmdOpts),
			);
		});

	lists
		.command("add-entry <list-id>")
		.description("Add a restaurant to a list")
		.option("--restaurant <restaurantId>", "Restaurant ID")
		.option("--notes <notes>", "Entry notes")
		.action(async (listId: string, cmdOpts: Record<string, unknown>) => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) =>
				executeAddEntry(c, createAdapter, createStore(), readJsonInput, listId, cmdOpts),
			);
		});

	lists
		.command("remove-entry <list-id>")
		.description("Remove a restaurant from a list")
		.option("--restaurant <restaurantId>", "Restaurant ID")
		.action(async (listId: string, cmdOpts: Record<string, unknown>) => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) =>
				executeRemoveEntry(c, createAdapter, createStore(), listId, cmdOpts),
			);
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

async function executeCreate(
	ctx: RunContext,
	createAdapter: AdapterFactory,
	store: SessionStore,
	readJsonInput: () => Promise<Record<string, unknown>>,
	cmdOpts: Record<string, unknown>,
): Promise<void> {
	const input = await buildWritePayload(ctx, readJsonInput, cmdOpts);
	const session = await requireSession(store, ctx.profile);
	const adapter = createAdapter(session);
	await validateSession(() => adapter.validateSession());
	const list = await adapter.createList({
		name: requireString(input.name, "name"),
		...optionalNullableString("description", input.description),
		...optionalVisibility(input.visibility),
	});
	printDetail(flattenList(list), ctx, asOutputRecord(list));
}

async function executeUpdate(
	ctx: RunContext,
	createAdapter: AdapterFactory,
	store: SessionStore,
	readJsonInput: () => Promise<Record<string, unknown>>,
	id: string,
	cmdOpts: Record<string, unknown>,
): Promise<void> {
	const input = await buildWritePayload(ctx, readJsonInput, cmdOpts);
	if (
		input.name === undefined &&
		input.description === undefined &&
		input.visibility === undefined
	) {
		throw new ValidationError("At least one list field must be provided", "input");
	}
	const session = await requireSession(store, ctx.profile);
	const adapter = createAdapter(session);
	await validateSession(() => adapter.validateSession());
	const list = await adapter.updateList(entityId<"List">(id), {
		...optionalString("name", input.name),
		...optionalNullableString("description", input.description),
		...optionalVisibility(input.visibility),
	});
	printDetail(flattenList(list), ctx, asOutputRecord(list));
}

async function executeDelete(
	ctx: RunContext,
	createAdapter: AdapterFactory,
	store: SessionStore,
	confirmAction: (question: string) => Promise<boolean>,
	id: string,
	cmdOpts: Record<string, unknown>,
): Promise<void> {
	const session = await requireSession(store, ctx.profile);
	const adapter = createAdapter(session);
	await validateSession(() => adapter.validateSession());
	if (!ctx.yes && cmdOpts.yes !== true) {
		const confirmed = await confirmAction(`Delete list "${id}"?`);
		if (!confirmed) {
			process.stderr.write("Aborted.\n");
			return;
		}
	}
	const listId = entityId<"List">(id);
	await adapter.deleteList(listId);
	if (ctx.json) {
		printJson({ deleted: true, id: listId });
	}
}

async function executeAddEntry(
	ctx: RunContext,
	createAdapter: AdapterFactory,
	store: SessionStore,
	readJsonInput: () => Promise<Record<string, unknown>>,
	listId: string,
	cmdOpts: Record<string, unknown>,
): Promise<void> {
	const input = await buildWritePayload(ctx, readJsonInput, cmdOpts);
	const session = await requireSession(store, ctx.profile);
	const adapter = createAdapter(session);
	await validateSession(() => adapter.validateSession());
	const list = await adapter.addListEntry(entityId<"List">(listId), {
		restaurantId: entityId<"Restaurant">(
			requireString(input.restaurant ?? input.restaurantId, "restaurant"),
		),
		...optionalNullableString("notes", input.notes),
	});
	printDetail(flattenList(list), ctx, asOutputRecord(list));
}

async function executeRemoveEntry(
	ctx: RunContext,
	createAdapter: AdapterFactory,
	store: SessionStore,
	listId: string,
	cmdOpts: Record<string, unknown>,
): Promise<void> {
	const restaurant = requireString(cmdOpts.restaurant, "restaurant");
	const session = await requireSession(store, ctx.profile);
	const adapter = createAdapter(session);
	await validateSession(() => adapter.validateSession());
	const list = await adapter.removeListEntry(
		entityId<"List">(listId),
		entityId<"Restaurant">(restaurant),
	);
	printDetail(flattenList(list), ctx, asOutputRecord(list));
}

function requireString(value: unknown, field: string): string {
	if (typeof value !== "string") {
		throw new ValidationError(`${field} is required`, field);
	}
	return value;
}

function optionalString(field: string, value: unknown): Record<string, string> {
	if (value === undefined) return {};
	if (typeof value !== "string") {
		throw new ValidationError(`${field} must be a string`, field);
	}
	return { [field]: value };
}

function optionalNullableString(field: string, value: unknown): Record<string, string | null> {
	if (value === undefined) return {};
	if (value === null) return { [field]: null };
	if (typeof value !== "string") {
		throw new ValidationError(`${field} must be a string or null`, field);
	}
	return { [field]: value };
}

function optionalVisibility(value: unknown): { visibility?: "public" | "private" } {
	if (value === undefined) return {};
	if (value !== "public" && value !== "private") {
		throw new ValidationError("visibility must be public or private", "visibility");
	}
	return { visibility: value };
}
