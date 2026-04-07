/** Resolved global flags carried through command execution. */
export interface RunContext {
	readonly json: boolean;
	readonly fields: readonly string[];
	readonly noColor: boolean;
	readonly yes: boolean;
	readonly profile: string;
	readonly experimental: boolean;
}
