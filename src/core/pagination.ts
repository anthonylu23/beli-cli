/** Cursor-based paginated result. */
export interface PaginatedResult<T> {
	readonly items: readonly T[];
	readonly nextCursor: string | null;
}
