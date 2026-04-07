import { beforeEach, describe, expect, mock, test } from "bun:test";
import { AuthRequiredError, UpstreamError, ValidationError } from "@core/errors.ts";
import type { RunContext } from "./context.ts";
import type { Column } from "./output.ts";
import { printDetail, printError, printJson, printTable } from "./output.ts";

function makeCtx(overrides: Partial<RunContext> = {}): RunContext {
	return {
		json: false,
		fields: [],
		noColor: false,
		yes: false,
		profile: "default",
		experimental: false,
		...overrides,
	};
}

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

describe("printJson", () => {
	test("writes formatted JSON to stdout", () => {
		const cap = captureStream(process.stdout);
		try {
			printJson({ a: 1 });
			expect(JSON.parse(cap.output)).toEqual({ a: 1 });
		} finally {
			cap.restore();
		}
	});
});

describe("printTable", () => {
	const columns: Column[] = [
		{ key: "name", label: "Name" },
		{ key: "score", label: "Score" },
	];
	const rows = [
		{ name: "Pizzeria", score: 8.5 },
		{ name: "Sushi Bar", score: 9.2 },
	];

	test("renders human-readable table", () => {
		const cap = captureStream(process.stdout);
		try {
			printTable(rows, columns, makeCtx());
			const lines = cap.output.split("\n").filter(Boolean);
			expect(lines.length).toBe(4); // header + separator + 2 rows
			expect(lines[0]).toContain("Name");
			expect(lines[0]).toContain("Score");
			expect(lines[2]).toContain("Pizzeria");
			expect(lines[3]).toContain("Sushi Bar");
		} finally {
			cap.restore();
		}
	});

	test("renders JSON array in --json mode", () => {
		const cap = captureStream(process.stdout);
		try {
			printTable(rows, columns, makeCtx({ json: true }));
			const parsed = JSON.parse(cap.output);
			expect(parsed).toEqual(rows);
		} finally {
			cap.restore();
		}
	});

	test("filters columns with --fields", () => {
		const cap = captureStream(process.stdout);
		try {
			printTable(rows, columns, makeCtx({ fields: ["name"] }));
			const lines = cap.output.split("\n").filter(Boolean);
			expect(lines[0]).toContain("Name");
			expect(lines[0]).not.toContain("Score");
		} finally {
			cap.restore();
		}
	});

	test("filters JSON fields with --fields", () => {
		const cap = captureStream(process.stdout);
		try {
			printTable(rows, columns, makeCtx({ json: true, fields: ["name"] }));
			const parsed = JSON.parse(cap.output);
			expect(parsed).toEqual([{ name: "Pizzeria" }, { name: "Sushi Bar" }]);
		} finally {
			cap.restore();
		}
	});
});

describe("printDetail", () => {
	const data = { name: "Pizzeria", score: 8.5, city: "NYC" };

	test("renders key-value pairs", () => {
		const cap = captureStream(process.stdout);
		try {
			printDetail(data, makeCtx());
			const output = cap.output;
			expect(output).toContain("name");
			expect(output).toContain("Pizzeria");
			expect(output).toContain("score");
			expect(output).toContain("8.5");
		} finally {
			cap.restore();
		}
	});

	test("renders JSON in --json mode", () => {
		const cap = captureStream(process.stdout);
		try {
			printDetail(data, makeCtx({ json: true }));
			expect(JSON.parse(cap.output)).toEqual(data);
		} finally {
			cap.restore();
		}
	});

	test("filters with --fields", () => {
		const cap = captureStream(process.stdout);
		try {
			printDetail(data, makeCtx({ json: true, fields: ["name"] }));
			expect(JSON.parse(cap.output)).toEqual({ name: "Pizzeria" });
		} finally {
			cap.restore();
		}
	});
});

describe("printError", () => {
	test("prints BeliError to stderr in human mode", () => {
		const cap = captureStream(process.stderr);
		try {
			printError(new ValidationError("bad input", "field"), makeCtx());
			expect(cap.output).toContain("error: bad input");
		} finally {
			cap.restore();
		}
	});

	test("prints BeliError as JSON to stderr in --json mode", () => {
		const cap = captureStream(process.stderr);
		try {
			printError(new AuthRequiredError("please log in"), makeCtx({ json: true }));
			const parsed = JSON.parse(cap.output);
			expect(parsed.error).toBe("auth_required");
			expect(parsed.message).toBe("please log in");
		} finally {
			cap.restore();
		}
	});

	test("prints unknown error to stderr", () => {
		const cap = captureStream(process.stderr);
		try {
			printError(new Error("oops"), makeCtx());
			expect(cap.output).toContain("error: oops");
		} finally {
			cap.restore();
		}
	});

	test("prints unknown error as JSON to stderr", () => {
		const cap = captureStream(process.stderr);
		try {
			printError(new Error("oops"), makeCtx({ json: true }));
			const parsed = JSON.parse(cap.output);
			expect(parsed.error).toBe("unknown");
			expect(parsed.message).toBe("oops");
		} finally {
			cap.restore();
		}
	});

	test("handles non-Error thrown values", () => {
		const cap = captureStream(process.stderr);
		try {
			printError("string error", makeCtx());
			expect(cap.output).toContain("An unexpected error occurred");
		} finally {
			cap.restore();
		}
	});
});
