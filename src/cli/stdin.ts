import { ValidationError } from "@core/errors.ts";

/**
 * Read all of stdin and parse as JSON.
 * Throws ValidationError if stdin is a TTY (no piped input) or if parsing fails.
 */
export async function readStdinJson<T>(): Promise<T> {
	if (process.stdin.isTTY) {
		throw new ValidationError(
			'No input on stdin. Pipe JSON and use "--input -"; file paths are not supported.',
			"input",
		);
	}

	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk as Buffer);
	}

	const raw = Buffer.concat(chunks).toString("utf-8").trim();

	if (!raw) {
		throw new ValidationError("Stdin was empty.", "input");
	}

	try {
		return JSON.parse(raw) as T;
	} catch {
		throw new ValidationError("Stdin contains invalid JSON.", "input");
	}
}
