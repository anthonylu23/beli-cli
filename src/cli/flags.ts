import type { Command } from "commander";
import type { RunContext } from "./context.ts";

/** Attach global options to a Commander program. */
export function addGlobalFlags(program: Command): void {
	program
		.option("--json", "Output JSON instead of human-readable text", false)
		.option("--fields <fields>", "Comma-separated list of fields to include in output")
		.option("--no-color", "Disable colored output")
		.option("--yes", "Skip confirmation prompts", false)
		.option("--profile <name>", "Config profile to use", "default")
		.option("--experimental", "Enable experimental features", false)
		.option("--input <source>", "Read input from source (use - for stdin)");
}

/** Parse Commander's raw option values into a typed RunContext. */
export function resolveContext(opts: Record<string, unknown>): RunContext {
	const noColor = opts.color === false || process.env.NO_COLOR !== undefined;

	const fieldsRaw = opts.fields;
	const fields: string[] =
		typeof fieldsRaw === "string"
			? fieldsRaw
					.split(",")
					.map((f) => f.trim())
					.filter(Boolean)
			: [];

	return {
		json: opts.json === true,
		fields,
		noColor,
		yes: opts.yes === true,
		profile: typeof opts.profile === "string" ? opts.profile : "default",
		experimental: opts.experimental === true,
	};
}
