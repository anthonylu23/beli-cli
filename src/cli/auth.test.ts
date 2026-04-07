import { describe, expect, spyOn, test } from "bun:test";
import type { BootstrapInput, Session, SessionStore } from "@core/session.ts";
import { timestamp } from "@core/types.ts";
import { createProgram } from "./index.ts";

/** Capture writes to a writable stream. */
function captureStream(stream: NodeJS.WriteStream) {
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
function interceptExit(): { code: number | undefined } {
	const result = { code: undefined as number | undefined };
	spyOn(process, "exit").mockImplementation((code?: number) => {
		result.code = code ?? 0;
		throw new Error(`__EXIT_${code}`);
	});
	return result;
}

function restoreExit(): void {
	(process.exit as ReturnType<typeof spyOn>).mockRestore?.();
}

function createMemorySessionStore(
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

async function runProgram(
	args: readonly string[],
	options: {
		readonly store?: SessionStore;
		readonly bootstrapInput?: BootstrapInput;
		readonly confirm?: (question: string) => Promise<boolean>;
		readonly validateToken?: (
			authToken: string,
			userId?: string,
		) => Promise<{
			valid: boolean;
			user?:
				| {
						id: string;
						username: string;
						displayName: string;
				  }
				| undefined;
		}>;
	} = {},
) {
	const stdout = captureStream(process.stdout);
	const stderr = captureStream(process.stderr);
	const exit = interceptExit();
	const store = options.store ?? createMemorySessionStore();
	const confirm =
		options.confirm ??
		(async () => {
			return true;
		});
	const readBootstrapInput =
		options.bootstrapInput === undefined
			? async () => {
					throw new Error("bootstrap input not provided");
				}
			: async () => options.bootstrapInput as BootstrapInput;
	const validateToken =
		options.validateToken ??
		(async (_authToken: string, userId?: string) => ({
			valid: true,
			user:
				userId === undefined
					? undefined
					: {
							id: userId,
							username: "tester",
							displayName: "Test User",
						},
		}));

	try {
		await createProgram({
			auth: {
				createSessionStore: () => store,
				confirm,
				readBootstrapInput,
				validateToken,
			},
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

describe("beli auth", () => {
	test("shows auth help with subcommands", async () => {
		const result = await runProgram(["auth", "--help"]);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("bootstrap");
		expect(result.stdout).toContain("status");
		expect(result.stdout).toContain("logout");
	});

	test("auth status exits 3 with no session", async () => {
		const result = await runProgram(["auth", "status"]);

		expect(result.exitCode).toBe(3);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain('No session found for profile "default"');
		expect(result.stderr).toContain("beli auth bootstrap");
	});

	test("auth status --json exits 3 with JSON error", async () => {
		const result = await runProgram(["--json", "auth", "status"]);

		expect(result.exitCode).toBe(3);
		expect(result.stdout).toBe("");

		const parsed = JSON.parse(result.stderr);
		expect(parsed.error).toBe("auth_required");
		expect(parsed.message).toContain('No session found for profile "default"');
	});

	test("auth bootstrap strips bearer prefix and persists null user id when omitted", async () => {
		const result = await runProgram(["auth", "bootstrap"], {
			bootstrapInput: {
				authToken: "Bearer token-123",
			},
		});

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout).toContain("status");
		expect(result.stdout).toContain("saved");
		expect(result.stdout).toContain("userId");
		expect(result.stdout).toContain("—");

		const session = await result.store.load("default");
		expect(session?.credentials.authToken).toBe("token-123");
		expect(session?.credentials.userId).toBeNull();
		expect(session?.metadata.userId).toBeNull();
	});

	test("auth bootstrap uses validated identity when available", async () => {
		const result = await runProgram(["--json", "auth", "bootstrap"], {
			bootstrapInput: {
				authToken: "token-123",
			},
			validateToken: async () => ({
				valid: true,
				user: {
					id: "user_123",
					username: "tester",
					displayName: "Test User",
				},
			}),
		});

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(JSON.parse(result.stdout)).toEqual({
			profile: "default",
			userId: "user_123",
			status: "saved",
			validated: "stub",
			message: "Token saved. Live validation will be available once API endpoints are configured.",
		});

		const session = await result.store.load("default");
		expect(session?.credentials.userId).toBe("user_123");
		expect(session?.metadata.username).toBe("tester");
	});

	test("auth bootstrap aborts replacement when confirmation is declined", async () => {
		const existingSession: Session = {
			credentials: {
				authToken: "old-token",
				refreshToken: null,
				userId: "user_001",
			},
			metadata: {
				profile: "default",
				userId: "user_001",
				username: "existing",
				displayName: "Existing User",
				bootstrappedAt: timestamp("2025-04-07T10:00:00.000Z"),
				lastValidatedAt: timestamp("2025-04-07T10:00:00.000Z"),
			},
		};
		const store = createMemorySessionStore(existingSession);

		const result = await runProgram(["auth", "bootstrap"], {
			store,
			bootstrapInput: {
				authToken: "new-token",
			},
			confirm: async () => false,
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("Aborted.");
		expect((await store.load("default"))?.credentials.authToken).toBe("old-token");
	});

	test("auth status shows stored session details", async () => {
		const store = createMemorySessionStore({
			credentials: {
				authToken: "token-123",
				refreshToken: null,
				userId: null,
			},
			metadata: {
				profile: "default",
				userId: null,
				username: null,
				displayName: null,
				bootstrappedAt: timestamp("2025-04-07T10:00:00.000Z"),
				lastValidatedAt: timestamp("2025-04-07T10:00:00.000Z"),
			},
		});

		const result = await runProgram(["auth", "status"], { store });

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout).toContain("profile");
		expect(result.stdout).toContain("default");
		expect(result.stdout).toContain("authenticated");
		expect(result.stdout).toContain("unverified");
		expect(result.stdout).toContain("userId");
		expect(result.stdout).toContain("—");
	});

	test("auth status --json renders the stored session", async () => {
		const store = createMemorySessionStore({
			credentials: {
				authToken: "token-123",
				refreshToken: null,
				userId: "user_123",
			},
			metadata: {
				profile: "default",
				userId: "user_123",
				username: "tester",
				displayName: "Test User",
				bootstrappedAt: timestamp("2025-04-07T10:00:00.000Z"),
				lastValidatedAt: timestamp("2025-04-07T10:00:00.000Z"),
			},
		});

		const result = await runProgram(["--json", "auth", "status"], { store });

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(JSON.parse(result.stdout)).toEqual({
			profile: "default",
			userId: "user_123",
			username: "tester",
			displayName: "Test User",
			bootstrappedAt: "2025-04-07T10:00:00.000Z",
			lastValidatedAt: "2025-04-07T10:00:00.000Z",
			authenticated: "unverified",
		});
	});

	test("auth logout with no session is idempotent", async () => {
		const result = await runProgram(["--yes", "auth", "logout"]);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain('No session found for profile "default"');
		expect(result.stderr).toContain("Nothing to remove");
	});

	test("auth logout removes the stored session", async () => {
		const store = createMemorySessionStore({
			credentials: {
				authToken: "token-123",
				refreshToken: null,
				userId: "user_123",
			},
			metadata: {
				profile: "default",
				userId: "user_123",
				username: "tester",
				displayName: "Test User",
				bootstrappedAt: timestamp("2025-04-07T10:00:00.000Z"),
				lastValidatedAt: timestamp("2025-04-07T10:00:00.000Z"),
			},
		});

		const result = await runProgram(["--yes", "auth", "logout"], { store });

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain('Session removed for profile "default".');
		expect(await store.load("default")).toBeNull();
	});

	test("auth logout aborts when confirmation is declined", async () => {
		const store = createMemorySessionStore({
			credentials: {
				authToken: "token-123",
				refreshToken: null,
				userId: "user_123",
			},
			metadata: {
				profile: "default",
				userId: "user_123",
				username: "tester",
				displayName: "Test User",
				bootstrappedAt: timestamp("2025-04-07T10:00:00.000Z"),
				lastValidatedAt: timestamp("2025-04-07T10:00:00.000Z"),
			},
		});

		const result = await runProgram(["auth", "logout"], {
			store,
			confirm: async () => false,
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("Aborted.");
		expect(await store.load("default")).not.toBeNull();
	});

	test("help output includes auth command", async () => {
		const result = await runProgram(["--help"]);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("auth");
	});
});
