import { describe, expect, test } from "bun:test";
import { VERSION, createProgram } from "./index.ts";
import { TEST_SESSION, createMemorySessionStore, runProgram } from "./test-helpers.ts";

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

		const commandNames = program.commands.map((command: { name(): string }) => command.name());
		expect(commandNames).toContain("raw");
		expect(commandNames).toContain("ratings");
		expect(commandNames).toContain("reviews");
	});

	test("threads top-level session store into auth commands", async () => {
		const store = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "auth", "status"], { store });
		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.stdout).profile).toBe("default");
	});

	test("lets auth-specific session store override the top-level store", async () => {
		const topLevelStore = createMemorySessionStore(null);
		const authStore = createMemorySessionStore(TEST_SESSION);
		const result = await runProgram(["--json", "auth", "status"], {
			store: topLevelStore,
			programOptions: {
				auth: {
					createSessionStore: () => authStore,
				},
			},
		});

		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.stdout).profile).toBe("default");
	});
});
