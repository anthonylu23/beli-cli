/**
 * Branded type utility. Creates a nominal type from a base type.
 * The brand exists only at the type level — zero runtime cost.
 */
declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

/** Opaque string identifier. All entity IDs flow through this. */
export type EntityId<T extends string = string> = Brand<string, T>;
export type UserId = EntityId<"User">;

/** ISO 8601 UTC timestamp string. */
export type Timestamp = Brand<string, "Timestamp">;

/** Create a branded entity ID. Used in adapters and tests, not in core logic. */
export function entityId<T extends string>(raw: string): EntityId<T> {
	if (raw.trim() !== raw || !raw || [...raw].some(isWhitespaceOrControlCharacter)) {
		throw new TypeError(
			"Entity ID must be a non-empty string without whitespace or control characters",
		);
	}
	return unsafeEntityId<T>(raw);
}

function isWhitespaceOrControlCharacter(character: string): boolean {
	const codePoint = character.codePointAt(0) ?? 0;
	return /\s/.test(character) || codePoint <= 31 || codePoint === 127;
}

/** Create a branded timestamp. Used in adapters and tests, not in core logic. */
export function timestamp(iso: string): Timestamp {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/.exec(iso);
	if (!match) {
		throw new TypeError("Timestamp must be a valid ISO 8601 UTC string");
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const hour = Number(match[4]);
	const minute = Number(match[5]);
	const second = Number(match[6]);
	const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
		month - 1
	];
	if (
		daysInMonth === undefined ||
		day < 1 ||
		day > daysInMonth ||
		hour > 23 ||
		minute > 59 ||
		second > 59
	) {
		throw new TypeError("Timestamp must be a valid ISO 8601 UTC string");
	}
	return unsafeTimestamp(iso);
}

function isLeapYear(year: number): boolean {
	return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Brand a trusted entity ID without runtime validation. */
export function unsafeEntityId<T extends string>(raw: string): EntityId<T> {
	return raw as EntityId<T>;
}

/** Brand a trusted timestamp without runtime validation. */
export function unsafeTimestamp(iso: string): Timestamp {
	return iso as Timestamp;
}
