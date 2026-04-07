#!/usr/bin/env bun

import { Command } from "commander";
import { registerRawCommand } from "./commands/raw.ts";
import { addGlobalFlags } from "./flags.ts";

export const VERSION = "0.1.0";

export function createProgram(): Command {
	const program = new Command()
		.name("beli")
		.version(VERSION, "-V, --version", "Print version")
		.description("Beli restaurant CLI");

	addGlobalFlags(program);
	registerRawCommand(program);

	return program;
}

if (import.meta.main) {
	await createProgram().parseAsync(process.argv);
}
