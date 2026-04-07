const SERVICE = "beli-cli";

/** Low-level macOS Keychain wrapper. */
export interface KeychainStore {
	/** Get the password for an account. Returns null if not found. */
	get(account: string): Promise<string | null>;

	/** Set (or update) the password for an account. */
	set(account: string, password: string): Promise<void>;

	/** Delete the entry for an account. Returns true if deleted, false if not found. */
	delete(account: string): Promise<boolean>;
}

interface SecurityCommandRequest {
	readonly args: readonly string[];
	readonly stdin?: string;
}

interface SecurityCommandResult {
	readonly exitCode: number;
	readonly stdout: string;
	readonly stderr: string;
}

type SecurityCommandRunner = (request: SecurityCommandRequest) => Promise<SecurityCommandResult>;

async function runSecurity({
	args,
	stdin,
}: SecurityCommandRequest): Promise<SecurityCommandResult> {
	const proc = Bun.spawn(["security", ...args], {
		stdin: stdin !== undefined ? new TextEncoder().encode(`${stdin}\n`) : "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});

	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);

	const exitCode = await proc.exited;
	return { exitCode, stdout, stderr };
}

interface KeychainStoreOptions {
	readonly service?: string;
	readonly runSecurity?: SecurityCommandRunner;
}

export function createKeychainStore(options: KeychainStoreOptions = {}): KeychainStore {
	const service = options.service ?? SERVICE;
	const runSecurityCommand = options.runSecurity ?? runSecurity;

	return {
		async get(account: string): Promise<string | null> {
			const result = await runSecurityCommand({
				args: ["find-generic-password", "-s", service, "-a", account, "-w"],
			});

			// Exit code 44 = item not found
			if (result.exitCode === 44) return null;

			if (result.exitCode !== 0) {
				throw new Error(`Keychain read failed (exit ${result.exitCode}): ${result.stderr.trim()}`);
			}

			return result.stdout.trim();
		},

		async set(account: string, password: string): Promise<void> {
			// Keep `-w` last and feed the secret on stdin so it is not exposed via argv.
			const result = await runSecurityCommand({
				args: ["add-generic-password", "-s", service, "-a", account, "-U", "-w"],
				stdin: password,
			});

			if (result.exitCode !== 0) {
				throw new Error(`Keychain write failed (exit ${result.exitCode}): ${result.stderr.trim()}`);
			}
		},

		async delete(account: string): Promise<boolean> {
			const result = await runSecurityCommand({
				args: ["delete-generic-password", "-s", service, "-a", account],
			});

			// Exit code 44 = item not found
			if (result.exitCode === 44) return false;

			if (result.exitCode !== 0) {
				throw new Error(
					`Keychain delete failed (exit ${result.exitCode}): ${result.stderr.trim()}`,
				);
			}

			return true;
		},
	};
}
