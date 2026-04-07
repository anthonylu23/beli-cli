import { UnsupportedFeatureError } from "@core/errors.ts";
import type { Command } from "commander";
import type { RunContext } from "../context.ts";
import { resolveContext } from "../flags.ts";
import { runCommand } from "../run.ts";

/** Register the `beli raw <resource>` command. */
export function registerRawCommand(program: Command): void {
	program
		.command("raw <resource>")
		.description("Low-level resource access (experimental)")
		.action(async (resource: string) => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);

			await runCommand(ctx, async () => {
				assertExperimental(ctx);
				await executeRaw(resource, ctx);
			});
		});
}

function assertExperimental(ctx: RunContext): void {
	if (!ctx.experimental) {
		throw new UnsupportedFeatureError(
			"The raw command requires --experimental. Usage: beli --experimental raw <resource>",
		);
	}
}

async function executeRaw(resource: string, _ctx: RunContext): Promise<void> {
	// Adapter implementation required (Phase 2+).
	// For now, print a placeholder explaining the resource was recognized.
	process.stdout.write(`raw: resource "${resource}" recognized. Adapter not yet implemented.\n`);
}
