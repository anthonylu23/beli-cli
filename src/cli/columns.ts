import type { Column } from "./output.ts";

export const USER_COLUMNS: readonly Column[] = [
	{ key: "id", label: "ID", minWidth: 10 },
	{ key: "username", label: "Username", minWidth: 12 },
	{ key: "displayName", label: "Display Name", minWidth: 15 },
];

export const RESTAURANT_COLUMNS: readonly Column[] = [
	{ key: "id", label: "ID", minWidth: 10 },
	{ key: "name", label: "Name", minWidth: 20 },
	{ key: "cuisines", label: "Cuisines", minWidth: 15 },
	{ key: "priceLevel", label: "Price", minWidth: 5 },
	{ key: "city", label: "City", minWidth: 10 },
];

export const LIST_COLUMNS: readonly Column[] = [
	{ key: "id", label: "ID", minWidth: 10 },
	{ key: "name", label: "Name", minWidth: 20 },
	{ key: "visibility", label: "Visibility", minWidth: 8 },
	{ key: "entryCount", label: "Entries", minWidth: 7 },
	{ key: "updatedAt", label: "Updated", minWidth: 20 },
];

export const FEED_ITEM_COLUMNS: readonly Column[] = [
	{ key: "id", label: "ID", minWidth: 10 },
	{ key: "type", label: "Type", minWidth: 14 },
	{ key: "userId", label: "User", minWidth: 10 },
	{ key: "createdAt", label: "Date", minWidth: 20 },
];
