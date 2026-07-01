import type { BeliAdapter } from "@adapters/private-mobile/contract.ts";
import { ValidationError } from "@core/errors.ts";
import type { Session, SessionStore } from "@core/session.ts";
import { entityId } from "@core/types.ts";
import type { Command } from "commander";
import { RESTAURANT_COLUMNS } from "../columns.ts";
import type { RunContext } from "../context.ts";
import { resolveContext } from "../flags.ts";
import { printDetail, printPaginatedTable } from "../output.ts";
import { addPaginationOptions, extractPagination } from "../pagination.ts";
import { asOutputRecord, flattenRestaurant, mapPaginated } from "../presenters.ts";
import { runCommand } from "../run.ts";
import { requireSession, validateSession } from "../session.ts";

type AdapterFactory = (session: Session) => BeliAdapter;

export interface RestaurantsCommandDeps {
	readonly createAdapter?: AdapterFactory;
	readonly createSessionStore?: () => SessionStore;
}

/** Register the `beli restaurants` command group. */
export function registerRestaurantsCommand(
	program: Command,
	defaultAdapter: AdapterFactory,
	defaultSessionStore: () => SessionStore,
	deps: RestaurantsCommandDeps = {},
): void {
	const createAdapter = deps.createAdapter ?? defaultAdapter;
	const createStore = deps.createSessionStore ?? defaultSessionStore;
	const restaurants = program.command("restaurants").description("Search and view restaurants");

	addPaginationOptions(
		restaurants
			.command("search <query>")
			.description("Search restaurants by name or cuisine")
			.option("--lat <latitude>", "Latitude for location-based search")
			.option("--lng <longitude>", "Longitude for location-based search"),
	).action(async (query: string, cmdOpts: Record<string, unknown>) => {
		const ctx = resolveContext(program.opts() as Record<string, unknown>);
		await runCommand(ctx, (c) => executeSearch(c, createAdapter, createStore(), query, cmdOpts));
	});

	restaurants
		.command("get <id>")
		.description("Get restaurant details by ID")
		.action(async (id: string) => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) => executeGet(c, createAdapter, createStore(), id));
		});
}

async function executeSearch(
	ctx: RunContext,
	createAdapter: AdapterFactory,
	store: SessionStore,
	query: string,
	cmdOpts: Record<string, unknown>,
): Promise<void> {
	const pagination = extractPagination(cmdOpts);
	const latitude = parseOptionalFiniteNumber(cmdOpts.lat, "lat", "--lat");
	const longitude = parseOptionalFiniteNumber(cmdOpts.lng, "lng", "--lng");
	if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
		throw new ValidationError("--lat must be between -90 and 90", "lat");
	}
	if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
		throw new ValidationError("--lng must be between -180 and 180", "lng");
	}
	const session = await requireSession(store, ctx.profile);
	const adapter = createAdapter(session);
	await validateSession(() => adapter.validateSession());
	const result = await adapter.searchRestaurants({
		query,
		...pagination,
		latitude,
		longitude,
	});
	printPaginatedTable(
		mapPaginated(result, flattenRestaurant),
		RESTAURANT_COLUMNS,
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
	const restaurant = await adapter.getRestaurant(entityId<"Restaurant">(id));
	printDetail(flattenRestaurant(restaurant), ctx, asOutputRecord(restaurant));
}

function parseOptionalFiniteNumber(
	value: unknown,
	field: string,
	flag: string,
): number | undefined {
	if (value === undefined) return undefined;
	if (typeof value !== "string" || !/^-?(?:\d+|\d*\.\d+)$/.test(value)) {
		throw new ValidationError(`${flag} must be a finite number`, field);
	}
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		throw new ValidationError(`${flag} must be a finite number`, field);
	}
	return parsed;
}
