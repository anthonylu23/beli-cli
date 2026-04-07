#!/usr/bin/env bun

import { Command } from "commander";
import { registerAuthCommand } from "./commands/auth.ts";
import { registerRawCommand } from "./commands/raw.ts";
import { addGlobalFlags } from "./flags.ts";

export const VERSION = "0.1.0";

type AuthCommandOptions = Parameters<typeof registerAuthCommand>[1];

interface ProgramOptions {
	readonly auth?: AuthCommandOptions;
}

export function createProgram(options: ProgramOptions = {}): Command {
	const program = new Command()
		.name("beli")
		.version(VERSION, "-V, --version", "Print version")
		.description("Beli restaurant CLI");

	addGlobalFlags(program);
	registerAuthCommand(program, options.auth);
	registerRawCommand(program);

	return program;
}

if (import.meta.main) {
	await createProgram().parseAsync(process.argv);
}
