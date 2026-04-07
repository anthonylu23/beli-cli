import { describe, expect, spyOn, test } from "bun:test";
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

async function runProgram(args: readonly string[]) {
	const stdout = captureStream(process.stdout);
	const stderr = captureStream(process.stderr);
	const exit = interceptExit();

	try {
		await createProgram().parseAsync(["bun", "beli", ...args]);
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
	};
}

describe("raw command", () => {
	test("requires --experimental in human mode", async () => {
		const result = await runProgram(["raw", "foo"]);

		expect(result.exitCode).toBe(5);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("error: The raw command requires --experimental.");
	});

	test("requires --experimental in json mode", async () => {
		const result = await runProgram(["--json", "raw", "foo"]);

		expect(result.exitCode).toBe(5);
		expect(result.stdout).toBe("");
		expect(JSON.parse(result.stderr)).toEqual({
			error: "unsupported",
			message: "The raw command requires --experimental. Usage: beli --experimental raw <resource>",
		});
	});

	test("renders structured placeholder output with input propagation", async () => {
		const result = await runProgram(["--experimental", "--input", "sample.json", "raw", "foo"]);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout).toContain("resource");
		expect(result.stdout).toContain("foo");
		expect(result.stdout).toContain("inputSource");
		expect(result.stdout).toContain("sample.json");
	});

	test("filters json output through the shared formatter layer", async () => {
		const result = await runProgram([
			"--json",
			"--experimental",
			"--fields",
			"resource,status",
			"raw",
			"foo",
		]);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(JSON.parse(result.stdout)).toEqual({
			resource: "foo",
			status: "recognized",
		});
	});
});
