import { describe, expect, test } from "bun:test";
import { VERSION, createProgram } from "./index.ts";

describe("createProgram", () => {
	test("registers root metadata, global flags, and subcommands", () => {
		const program = createProgram();

		expect(program.name()).toBe("beli");
		expect(program.description()).toBe("Beli restaurant CLI");
		expect(program.version()).toBe(VERSION);

		const optionNames = program.options.map((option: { attributeName(): string }) =>
			option.attributeName(),
		);
		expect(optionNames).toContain("json");
		expect(optionNames).toContain("fields");
		expect(optionNames).toContain("color");
		expect(optionNames).toContain("yes");
		expect(optionNames).toContain("profile");
		expect(optionNames).toContain("experimental");
		expect(optionNames).toContain("input");
		expect(optionNames.filter((name: string) => name === "json")).toHaveLength(1);
		expect(optionNames.filter((name: string) => name === "input")).toHaveLength(1);

		expect(program.commands.map((command: { name(): string }) => command.name())).toContain("raw");
	});
});
