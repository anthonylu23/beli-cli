import type { BeliAdapter } from "@adapters/private-mobile/contract.ts";
import { ValidationError } from "@core/errors.ts";
import type { Session, SessionStore } from "@core/session.ts";
import { entityId } from "@core/types.ts";
import type { Command } from "commander";
import type { RunContext } from "../context.ts";
import { resolveContext } from "../flags.ts";
import { printDetail, printJson } from "../output.ts";
import { asOutputRecord, flattenRating } from "../presenters.ts";
import { runCommand } from "../run.ts";
import { requireSession, validateSession } from "../session.ts";
import { readStdinJson } from "../stdin.ts";
import { buildWritePayload, confirmAction as defaultConfirm } from "../write-utils.ts";

type AdapterFactory = (session: Session) => BeliAdapter;

export interface RatingsCommandDeps {
	readonly createAdapter?: AdapterFactory;
	readonly createSessionStore?: () => SessionStore;
	readonly readJsonInput?: () => Promise<Record<string, unknown>>;
	readonly confirm?: (question: string) => Promise<boolean>;
}

/** Register the `beli ratings` command group. */
export function registerRatingsCommand(
	program: Command,
	defaultAdapter: AdapterFactory,
	defaultSessionStore: () => SessionStore,
	deps: RatingsCommandDeps = {},
): void {
	const createAdapter = deps.createAdapter ?? defaultAdapter;
	const createStore = deps.createSessionStore ?? defaultSessionStore;
	const readJsonInput = deps.readJsonInput ?? readStdinJson<Record<string, unknown>>;
	const confirmAction = deps.confirm ?? defaultConfirm;
	const ratings = program.command("ratings").description("Create and manage restaurant ratings");

	ratings
		.command("create")
		.description("Create a restaurant rating")
		.option("--restaurant <restaurantId>", "Restaurant ID")
		.option("--score <score>", "Rating score from 0 to 10")
		.option("--favorite-dishes <dishes>", "Comma-separated favorite dishes")
		.option("--tags <tags>", "Comma-separated tags")
		.action(async (cmdOpts: Record<string, unknown>) => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) =>
				executeCreate(c, createAdapter, createStore(), readJsonInput, cmdOpts),
			);
		});

	ratings
		.command("update <id>")
		.description("Update a restaurant rating")
		.option("--score <score>", "Rating score from 0 to 10")
		.option("--favorite-dishes <dishes>", "Comma-separated favorite dishes")
		.option("--tags <tags>", "Comma-separated tags")
		.action(async (id: string, cmdOpts: Record<string, unknown>) => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) =>
				executeUpdate(c, createAdapter, createStore(), readJsonInput, id, cmdOpts),
			);
		});

	ratings
		.command("delete <id>")
		.description("Delete a restaurant rating")
		.option("--yes", "Skip confirmation prompt", false)
		.action(async (id: string, cmdOpts: Record<string, unknown>) => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) =>
				executeDelete(c, createAdapter, createStore(), confirmAction, id, cmdOpts),
			);
		});
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
	const rating = await adapter.createRating({
		restaurantId: entityId<"Restaurant">(
			requireString(input.restaurant ?? input.restaurantId, "restaurant"),
		),
		score: requireScore(input.score),
		...optionalStringArray("favoriteDishes", input.favoriteDishes),
		...optionalStringArray("tags", input.tags),
	});
	printDetail(flattenRating(rating), ctx, asOutputRecord(rating));
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
	if (input.score === undefined && input.favoriteDishes === undefined && input.tags === undefined) {
		throw new ValidationError("At least one rating field must be provided", "input");
	}
	const session = await requireSession(store, ctx.profile);
	const adapter = createAdapter(session);
	await validateSession(() => adapter.validateSession());
	const rating = await adapter.updateRating(entityId<"Rating">(id), {
		...optionalScore(input.score),
		...optionalStringArray("favoriteDishes", input.favoriteDishes),
		...optionalStringArray("tags", input.tags),
	});
	printDetail(flattenRating(rating), ctx, asOutputRecord(rating));
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
		const confirmed = await confirmAction(`Delete rating "${id}"?`);
		if (!confirmed) {
			process.stderr.write("Aborted.\n");
			return;
		}
	}
	const ratingId = entityId<"Rating">(id);
	await adapter.deleteRating(ratingId);
	if (ctx.json) {
		printJson({ deleted: true, id: ratingId });
	}
}

function requireString(value: unknown, field: string): string {
	if (typeof value !== "string") {
		throw new ValidationError(`${field} is required`, field);
	}
	return value;
}

function requireScore(value: unknown): number {
	if (value === undefined) {
		throw new ValidationError("score is required", "score");
	}
	return parseScore(value);
}

function optionalScore(value: unknown): { score?: number } {
	if (value === undefined) return {};
	return { score: parseScore(value) };
}

function parseScore(value: unknown): number {
	const parsed =
		typeof value === "number"
			? value
			: typeof value === "string" && value.trim() !== ""
				? Number(value)
				: Number.NaN;
	if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
		throw new ValidationError("score must be a finite number from 0 to 10", "score");
	}
	return parsed;
}

function optionalStringArray(field: string, value: unknown): Record<string, readonly string[]> {
	if (value === undefined) return {};
	if (typeof value === "string") {
		return {
			[field]: value
				.split(",")
				.map((item) => item.trim())
				.filter(Boolean),
		};
	}
	if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
		throw new ValidationError(`${field} must be a string array or comma-separated string`, field);
	}
	return { [field]: value };
}
