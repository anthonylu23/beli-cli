import { BeliError } from "@core/errors.ts";
import { ExitCode } from "@core/exit-codes.ts";
import type { RunContext } from "./context.ts";
import { printError } from "./output.ts";

/**
 * Execute a command function with consistent error handling and exit behavior.
 *
 * - On success: exits with ExitCode.Success (0).
 * - On BeliError: prints structured error to stderr, exits with the error's code.
 * - On unknown error: prints generic message to stderr, exits with 1.
 */
export async function runCommand(
	ctx: RunContext,
	fn: (ctx: RunContext) => Promise<void>,
): Promise<never> {
	let exitCode: number = ExitCode.Success;

	try {
		await fn(ctx);
	} catch (error) {
		printError(error, ctx);
		exitCode = error instanceof BeliError ? error.code : 1;
	}

	process.exit(exitCode);
}
