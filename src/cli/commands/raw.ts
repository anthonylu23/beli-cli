import { UnsupportedFeatureError } from "@core/errors.ts";
import type { Command } from "commander";
import type { RunContext } from "../context.ts";
import { resolveContext } from "../flags.ts";
import { printDetail } from "../output.ts";
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

async function executeRaw(resource: string, ctx: RunContext): Promise<void> {
	const payload = {
		resource,
		status: "recognized",
		implemented: false,
		message: "Adapter not yet implemented.",
		...(ctx.input !== undefined ? { inputSource: ctx.input } : {}),
	} as const;

	printDetail(payload, ctx);
}
