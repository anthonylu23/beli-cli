import { describe, expect, spyOn, test } from "bun:test";
import {
	AuthRequiredError,
	UnsupportedFeatureError,
	UpstreamError,
	ValidationError,
} from "@core/errors.ts";
import { ExitCode } from "@core/exit-codes.ts";
import type { RunContext } from "./context.ts";
import { runCommand } from "./run.ts";

function makeCtx(overrides: Partial<RunContext> = {}): RunContext {
	return {
		json: false,
		fields: [],
		noColor: false,
		yes: false,
		profile: "default",
		experimental: false,
		...overrides,
	};
}

/** Intercept process.exit to capture the exit code instead of terminating. */
function interceptExit(): { code: number | undefined } {
	const result = { code: undefined as number | undefined };
	const spy = spyOn(process, "exit").mockImplementation((code?: number) => {
		result.code = code ?? 0;
		throw new Error(`__EXIT_${code}`);
	});
	return result;
}

function restoreExit(): void {
	(process.exit as ReturnType<typeof spyOn>).mockRestore?.();
}

describe("runCommand", () => {
	test("exits with 0 on success", async () => {
		const exit = interceptExit();
		try {
			await runCommand(makeCtx(), async () => {});
		} catch {
			// Expected: mockExit throws
		} finally {
			restoreExit();
		}
		expect(exit.code).toBe(ExitCode.Success);
	});

	test("exits with ValidationError code (2)", async () => {
		const exit = interceptExit();
		// Suppress stderr noise
		const stderrWrite = process.stderr.write;
		process.stderr.write = (() => true) as typeof process.stderr.write;
		try {
			await runCommand(makeCtx(), async () => {
				throw new ValidationError("bad");
			});
		} catch {
			// Expected
		} finally {
			process.stderr.write = stderrWrite;
			restoreExit();
		}
		expect(exit.code).toBe(ExitCode.ValidationError);
	});

	test("exits with AuthRequired code (3)", async () => {
		const exit = interceptExit();
		process.stderr.write = (() => true) as typeof process.stderr.write;
		try {
			await runCommand(makeCtx(), async () => {
				throw new AuthRequiredError("auth needed");
			});
		} catch {
			// Expected
		} finally {
			process.stderr.write = (
				process.stderr as unknown as { write: typeof process.stderr.write }
			).write;
			restoreExit();
		}
		expect(exit.code).toBe(ExitCode.AuthRequired);
	});

	test("exits with UpstreamFailure code (4)", async () => {
		const exit = interceptExit();
		const origWrite = process.stderr.write;
		process.stderr.write = (() => true) as typeof process.stderr.write;
		try {
			await runCommand(makeCtx(), async () => {
				throw new UpstreamError("api down", 500);
			});
		} catch {
			// Expected
		} finally {
			process.stderr.write = origWrite;
			restoreExit();
		}
		expect(exit.code).toBe(ExitCode.UpstreamFailure);
	});

	test("exits with UnsupportedFeature code (5)", async () => {
		const exit = interceptExit();
		const origWrite = process.stderr.write;
		process.stderr.write = (() => true) as typeof process.stderr.write;
		try {
			await runCommand(makeCtx(), async () => {
				throw new UnsupportedFeatureError("not yet");
			});
		} catch {
			// Expected
		} finally {
			process.stderr.write = origWrite;
			restoreExit();
		}
		expect(exit.code).toBe(ExitCode.UnsupportedFeature);
	});

	test("exits with 1 on unknown error", async () => {
		const exit = interceptExit();
		const origWrite = process.stderr.write;
		process.stderr.write = (() => true) as typeof process.stderr.write;
		try {
			await runCommand(makeCtx(), async () => {
				throw new Error("unexpected");
			});
		} catch {
			// Expected
		} finally {
			process.stderr.write = origWrite;
			restoreExit();
		}
		expect(exit.code).toBe(1);
	});
});
