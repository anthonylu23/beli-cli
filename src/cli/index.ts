#!/usr/bin/env bun

import { Command } from "commander";
import { registerRawCommand } from "./commands/raw.ts";
import { addGlobalFlags } from "./flags.ts";

const VERSION = "0.1.0";

const program = new Command()
	.name("beli")
	.version(VERSION, "-V, --version", "Print version")
	.description("Beli restaurant CLI");

addGlobalFlags(program);
registerRawCommand(program);

program.parse();
