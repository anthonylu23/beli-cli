/**
 * Branded type utility. Creates a nominal type from a base type.
 * The brand exists only at the type level — zero runtime cost.
 */
declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

/** Opaque string identifier. All entity IDs flow through this. */
export type EntityId<T extends string = string> = Brand<string, T>;

/** ISO 8601 UTC timestamp string. */
export type Timestamp = Brand<string, "Timestamp">;

/** Create a branded entity ID. Used in adapters and tests, not in core logic. */
export function entityId<T extends string>(raw: string): EntityId<T> {
	return raw as EntityId<T>;
}

/** Create a branded timestamp. Used in adapters and tests, not in core logic. */
export function timestamp(iso: string): Timestamp {
	return iso as Timestamp;
}
