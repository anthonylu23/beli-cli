import { spyOn } from "bun:test";
import type { BeliAdapter } from "@adapters/private-mobile/contract.ts";
import { createStubAdapter } from "@adapters/private-mobile/stub.ts";
import type { Session, SessionStore } from "@core/session.ts";
import { timestamp } from "@core/types.ts";
import type { ProgramOptions } from "./index.ts";
import { createProgram } from "./index.ts";

/** Capture writes to a writable stream. */
export function captureStream(stream: NodeJS.WriteStream) {
	const chunks: string[] = [];
	const originalWrite = stream.write.bind(stream);
	stream.write = ((data: string | Uint8Array) => {
		chunks.push(typeof data === "string" ? data : new TextDecoder().decode(data));
		return true;
	}) as typeof stream.write;
	return {
		get output() {
			return chunks.join("");
		},
		restore() {
			stream.write = originalWrite;
		},
	};
}

/** Intercept process.exit to capture the exit code instead of terminating. */
export function interceptExit(): { code: number | undefined } {
	const result = { code: undefined as number | undefined };
	spyOn(process, "exit").mockImplementation((code?: number) => {
		result.code = code ?? 0;
		throw new Error(`__EXIT_${code}`);
	});
	return result;
}

export function restoreExit(): void {
	(process.exit as ReturnType<typeof spyOn>).mockRestore?.();
}

/** In-memory SessionStore for testing. */
export function createMemorySessionStore(
	initial?: Session | null,
): SessionStore & { session: Session | null } {
	return {
		session: initial ?? null,
		async load() {
			return this.session;
		},
		async save(_profile, session) {
			this.session = session;
		},
		async delete() {
			this.session = null;
		},
		async exists() {
			return this.session !== null;
		},
	};
}

/** A valid session fixture for tests that need authentication. */
export const TEST_SESSION: Session = {
	credentials: {
		authToken: "test-token",
		refreshToken: null,
		userId: "user_001",
	},
	metadata: {
		profile: "default",
		userId: "user_001",
		username: "testuser",
		displayName: "Test User",
		bootstrappedAt: timestamp("2025-04-07T10:00:00.000Z"),
		lastValidatedAt: timestamp("2025-04-07T10:00:00.000Z"),
	},
};

/** Run a program with captured I/O and intercepted exit. */
export async function runProgram(
	args: readonly string[],
	options: {
		readonly programOptions?: ProgramOptions;
		readonly store?: SessionStore;
		readonly adapter?: (session: Session) => BeliAdapter;
	} = {},
) {
	const stdout = captureStream(process.stdout);
	const stderr = captureStream(process.stderr);
	const exit = interceptExit();
	const store = options.store ?? createMemorySessionStore();
	const adapter = options.adapter ?? createStubAdapter;

	try {
		await createProgram({
			...options.programOptions,
			createAdapter: adapter,
			createSessionStore: () => store,
		}).parseAsync(["bun", "beli", ...args]);
	} catch (error) {
		if (!(error instanceof Error) || !error.message.startsWith("__EXIT_")) {
			throw error;
		}
	} finally {
		stdout.restore();
		stderr.restore();
		restoreExit();
	}

	return {
		exitCode: exit.code,
		stdout: stdout.output,
		stderr: stderr.output,
		store,
	};
}
