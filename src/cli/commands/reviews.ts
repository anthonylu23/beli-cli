import { createInterface } from "node:readline";
import type { BeliAdapter } from "@adapters/private-mobile/contract.ts";
import { ValidationError } from "@core/errors.ts";
import type { Session, SessionStore } from "@core/session.ts";
import { entityId } from "@core/types.ts";
import type { EntityId } from "@core/types.ts";
import type { Command } from "commander";
import type { RunContext } from "../context.ts";
import { resolveContext } from "../flags.ts";
import { printDetail, printJson } from "../output.ts";
import { asOutputRecord, flattenReview } from "../presenters.ts";
import { runCommand } from "../run.ts";
import { requireSession, validateSession } from "../session.ts";
import { readStdinJson } from "../stdin.ts";

type AdapterFactory = (session: Session) => BeliAdapter;

export interface ReviewsCommandDeps {
	readonly createAdapter?: AdapterFactory;
	readonly createSessionStore?: () => SessionStore;
	readonly readJsonInput?: () => Promise<Record<string, unknown>>;
	readonly confirm?: (question: string) => Promise<boolean>;
}

/** Register the `beli reviews` command group. */
export function registerReviewsCommand(
	program: Command,
	defaultAdapter: AdapterFactory,
	defaultSessionStore: () => SessionStore,
	deps: ReviewsCommandDeps = {},
): void {
	const createAdapter = deps.createAdapter ?? defaultAdapter;
	const createStore = deps.createSessionStore ?? defaultSessionStore;
	const readJsonInput = deps.readJsonInput ?? readStdinJson<Record<string, unknown>>;
	const confirmAction = deps.confirm ?? confirm;
	const reviews = program.command("reviews").description("Create and manage restaurant reviews");

	reviews
		.command("create")
		.description("Create a restaurant review")
		.option("--restaurant <restaurantId>", "Restaurant ID")
		.option("--body <body>", "Review body")
		.option("--rating <ratingId>", "Linked rating ID")
		.option("--image-urls <urls>", "Comma-separated image URLs")
		.action(async (cmdOpts: Record<string, unknown>) => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) =>
				executeCreate(c, createAdapter, createStore(), readJsonInput, cmdOpts),
			);
		});

	reviews
		.command("update <id>")
		.description("Update a restaurant review")
		.option("--body <body>", "Review body")
		.option("--image-urls <urls>", "Comma-separated image URLs")
		.action(async (id: string, cmdOpts: Record<string, unknown>) => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) =>
				executeUpdate(c, createAdapter, createStore(), readJsonInput, id, cmdOpts),
			);
		});

	reviews
		.command("delete <id>")
		.description("Delete a restaurant review")
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
	const input = await buildPayload(ctx, readJsonInput, cmdOpts);
	const session = await requireSession(store, ctx.profile);
	const adapter = createAdapter(session);
	await validateSession(() => adapter.validateSession());
	const review = await adapter.createReview({
		restaurantId: entityId<"Restaurant">(
			requireString(input.restaurant ?? input.restaurantId, "restaurant"),
		),
		body: requireString(input.body, "body"),
		...optionalRatingId(input.rating ?? input.ratingId),
		...optionalStringArray("imageUrls", input.imageUrls),
	});
	printDetail(flattenReview(review), ctx, asOutputRecord(review));
}

async function executeUpdate(
	ctx: RunContext,
	createAdapter: AdapterFactory,
	store: SessionStore,
	readJsonInput: () => Promise<Record<string, unknown>>,
	id: string,
	cmdOpts: Record<string, unknown>,
): Promise<void> {
	const input = await buildPayload(ctx, readJsonInput, cmdOpts);
	if (input.body === undefined && input.imageUrls === undefined) {
		throw new ValidationError("At least one review field must be provided", "input");
	}
	const session = await requireSession(store, ctx.profile);
	const adapter = createAdapter(session);
	await validateSession(() => adapter.validateSession());
	const review = await adapter.updateReview(entityId<"Review">(id), {
		...optionalString("body", input.body),
		...optionalStringArray("imageUrls", input.imageUrls),
	});
	printDetail(flattenReview(review), ctx, asOutputRecord(review));
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
		const confirmed = await confirmAction(`Delete review "${id}"?`);
		if (!confirmed) {
			process.stderr.write("Aborted.\n");
			return;
		}
	}
	const reviewId = entityId<"Review">(id);
	await adapter.deleteReview(reviewId);
	if (ctx.json) {
		printJson({ deleted: true, id: reviewId });
	}
}

async function buildPayload(
	ctx: RunContext,
	readJsonInput: () => Promise<Record<string, unknown>>,
	cmdOpts: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const payload = ctx.input === undefined ? {} : await readInputPayload(ctx, readJsonInput);
	return {
		...payload,
		...definedOptions(cmdOpts),
	};
}

async function readInputPayload(
	ctx: RunContext,
	readJsonInput: () => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
	if (ctx.input !== "-") {
		throw new ValidationError('Only "--input -" is supported for review write commands.', "input");
	}
	const input = await readJsonInput();
	if (input === null || Array.isArray(input) || typeof input !== "object") {
		throw new ValidationError("Input JSON must be an object.", "input");
	}
	return input;
}

function definedOptions(options: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(options)) {
		if (value !== undefined) result[key] = value;
	}
	return result;
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

function optionalRatingId(value: unknown): { ratingId?: EntityId<"Rating"> | null } {
	if (value === undefined) return {};
	if (value === null) return { ratingId: null };
	return { ratingId: entityId<"Rating">(requireString(value, "rating")) };
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

function confirm(question: string): Promise<boolean> {
	const rl = createInterface({ input: process.stdin, output: process.stderr });
	return new Promise((resolve) => {
		rl.question(`${question} [y/N] `, (answer) => {
			rl.close();
			resolve(answer.trim().toLowerCase() === "y");
		});
	});
}
