import type { Interface as ReadlineInterface } from "node:readline";
import { createInterface } from "node:readline";
import type { BeliAdapter } from "@adapters/private-mobile/contract.ts";
import { validateToken } from "@adapters/private-mobile/validate.ts";
import { AuthRequiredError } from "@core/errors.ts";
import type { BootstrapInput, Session, SessionStore } from "@core/session.ts";
import { timestamp } from "@core/types.ts";
import { createConfigStore } from "@infra/config.ts";
import { createKeychainStore } from "@infra/keychain.ts";
import { createSessionStore } from "@infra/session-store.ts";
import type { Command } from "commander";
import type { RunContext } from "../context.ts";
import { resolveContext } from "../flags.ts";
import { printDetail } from "../output.ts";
import { runCommand } from "../run.ts";
import { validateSession } from "../session.ts";
import { readStdinJson } from "../stdin.ts";

type AdapterFactory = (session: Session) => BeliAdapter;

export interface AuthCommandDeps {
	readonly createSessionStore?: () => SessionStore;
	readonly createAdapter?: AdapterFactory;
	readonly validateToken?: typeof validateToken;
	readonly readBootstrapInput?: (ctx: RunContext) => Promise<BootstrapInput>;
	readonly confirm?: (question: string) => Promise<boolean>;
}

function buildSessionStore(): SessionStore {
	return createSessionStore(createKeychainStore(), createConfigStore());
}

/** Register the `beli auth` command group. */
export function registerAuthCommand(program: Command, deps: AuthCommandDeps = {}): void {
	const createStore = deps.createSessionStore ?? buildSessionStore;
	const createAdapter = deps.createAdapter;
	const validateAuthToken = deps.validateToken ?? validateToken;
	const readBootstrapInput = deps.readBootstrapInput ?? gatherBootstrapInput;
	const confirmAction = deps.confirm ?? confirm;
	const auth = program.command("auth").description("Manage authentication and sessions");

	auth
		.command("bootstrap")
		.description("Import session from Beli mobile app")
		.action(async () => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) =>
				executeBootstrap(c, createStore(), {
					validateToken: validateAuthToken,
					readBootstrapInput,
					confirm: confirmAction,
				}),
			);
		});

	auth
		.command("status")
		.description("Show current authentication status")
		.action(async () => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) => executeStatus(c, createStore(), createAdapter));
		});

	auth
		.command("logout")
		.description("Remove stored session")
		.action(async () => {
			const ctx = resolveContext(program.opts() as Record<string, unknown>);
			await runCommand(ctx, (c) => executeLogout(c, createStore(), confirmAction));
		});
}

// ── Bootstrap ───────────────────────────────────────────────────────

interface ExecuteBootstrapDeps {
	readonly validateToken: typeof validateToken;
	readonly readBootstrapInput: (ctx: RunContext) => Promise<BootstrapInput>;
	readonly confirm: (question: string) => Promise<boolean>;
}

async function executeBootstrap(
	ctx: RunContext,
	store: SessionStore,
	deps: ExecuteBootstrapDeps,
): Promise<void> {
	const input = await deps.readBootstrapInput(ctx);

	// Check for existing session
	if (await store.exists(ctx.profile)) {
		if (!ctx.yes) {
			const confirmed = await deps.confirm(
				`A session already exists for profile "${ctx.profile}". Replace it?`,
			);
			if (!confirmed) {
				process.stderr.write("Aborted.\n");
				return;
			}
		}
	}

	// Normalize token: strip "Bearer " prefix if present
	const authToken = input.authToken.replace(/^Bearer\s+/i, "");

	// Validate (stubbed for now)
	const result = await deps.validateToken(authToken, input.userId);
	const userId = result.user?.id ?? input.userId ?? null;

	const now = timestamp(new Date().toISOString());

	await store.save(ctx.profile, {
		credentials: {
			authToken,
			refreshToken: input.refreshToken ?? null,
			userId,
		},
		metadata: {
			profile: ctx.profile,
			userId,
			username: result.user?.username ?? null,
			displayName: result.user?.displayName ?? null,
			bootstrappedAt: now,
			lastValidatedAt: now,
		},
	});

	printDetail(
		{
			profile: ctx.profile,
			userId: userId ?? "—",
			status: "saved",
			validated: result.valid ? "stub" : false,
			message: "Token saved. Live validation will be available once API endpoints are configured.",
		},
		ctx,
	);
}

async function gatherBootstrapInput(ctx: RunContext): Promise<BootstrapInput> {
	// Piped mode: read JSON from stdin
	if (!process.stdin.isTTY) {
		return readStdinJson<BootstrapInput>();
	}

	// Interactive mode
	process.stderr.write(`
Beli CLI needs session tokens from the Beli mobile app.

To capture these tokens:
  1. Set up an HTTP proxy (mitmproxy, Charles, Proxyman)
  2. Configure your phone to use the proxy
  3. Open the Beli app and perform any action
  4. Find an API request and copy the Authorization header value

`);

	const rl = createInterface({ input: process.stdin, output: process.stderr });
	try {
		const authToken = await prompt(rl, "Auth token: ");
		if (!authToken.trim()) {
			throw new AuthRequiredError("No auth token provided.");
		}

		const refreshToken = await prompt(rl, "Refresh token (Enter to skip): ");
		const userId = await prompt(rl, "User ID (Enter to skip): ");

		return {
			authToken: authToken.trim(),
			...(refreshToken.trim() ? { refreshToken: refreshToken.trim() } : {}),
			...(userId.trim() ? { userId: userId.trim() } : {}),
		};
	} finally {
		rl.close();
	}
}

function prompt(rl: ReadlineInterface, question: string): Promise<string> {
	return new Promise((resolve) => {
		rl.question(question, resolve);
	});
}

function confirm(question: string): Promise<boolean> {
	const rl = createInterface({ input: process.stdin, output: process.stderr });
	return new Promise((resolve) => {
		rl.question(`${question} [y/N] `, (answer) => {
			rl.close();
			resolve(answer.trim().toLowerCase() === "y");
		});
	});
}

// ── Status ──────────────────────────────────────────────────────────

async function executeStatus(
	ctx: RunContext,
	store: SessionStore,
	createAdapter?: AdapterFactory,
): Promise<void> {
	const session = await store.load(ctx.profile);

	if (!session) {
		throw new AuthRequiredError(
			`No session found for profile "${ctx.profile}". Run "beli auth bootstrap" to authenticate.`,
		);
	}

	let authenticated = "unverified";
	if (createAdapter) {
		const adapter = createAdapter(session);
		await validateSession(() => adapter.validateSession());
		authenticated = "verified";
	}

	printDetail(
		{
			profile: session.metadata.profile,
			userId: session.metadata.userId ?? "—",
			username: session.metadata.username ?? "—",
			displayName: session.metadata.displayName ?? "—",
			bootstrappedAt: session.metadata.bootstrappedAt,
			lastValidatedAt: session.metadata.lastValidatedAt,
			authenticated,
		},
		ctx,
	);
}

// ── Logout ──────────────────────────────────────────────────────────

async function executeLogout(
	ctx: RunContext,
	store: SessionStore,
	confirmAction: (question: string) => Promise<boolean>,
): Promise<void> {
	const exists = await store.exists(ctx.profile);

	if (!exists) {
		process.stderr.write(`No session found for profile "${ctx.profile}". Nothing to remove.\n`);
		return;
	}

	if (!ctx.yes) {
		const confirmed = await confirmAction(`Remove session for profile "${ctx.profile}"?`);
		if (!confirmed) {
			process.stderr.write("Aborted.\n");
			return;
		}
	}

	await store.delete(ctx.profile);
	process.stderr.write(`Session removed for profile "${ctx.profile}".\n`);
}
