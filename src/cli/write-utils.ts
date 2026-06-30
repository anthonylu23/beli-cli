import { createInterface } from "node:readline";
import { ValidationError } from "@core/errors.ts";
import type { RunContext } from "./context.ts";

export async function buildWritePayload(
	ctx: RunContext,
	readJsonInput: () => Promise<Record<string, unknown>>,
	cmdOpts: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const payload = ctx.input === undefined ? {} : await readWriteInput(ctx, readJsonInput);
	return { ...payload, ...definedOptions(cmdOpts) };
}

async function readWriteInput(
	ctx: RunContext,
	readJsonInput: () => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
	if (ctx.input !== "-") {
		throw new ValidationError(
			'"--input -" reads JSON from stdin; file paths are not supported.',
			"input",
		);
	}
	const input: unknown = await readJsonInput();
	if (input === null || Array.isArray(input) || typeof input !== "object") {
		throw new ValidationError("Input JSON must be an object.", "input");
	}
	return input as Record<string, unknown>;
}

function definedOptions(options: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined));
}

export function confirmAction(question: string): Promise<boolean> {
	const rl = createInterface({ input: process.stdin, output: process.stderr });
	return new Promise((resolve) => {
		rl.question(`${question} [y/N] `, (answer) => {
			rl.close();
			resolve(answer.trim().toLowerCase() === "y");
		});
	});
}
