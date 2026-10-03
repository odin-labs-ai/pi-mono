import { describe, expect, it } from "vitest";
import { parseFinalToolArguments, parseStreamingJson } from "../src/utils/json-parse.ts";

describe("final streamed tool arguments", () => {
	it("keeps partial recovery available for live previews", () => {
		expect(parseStreamingJson('{"path":"src/app')).toEqual({ path: "src/app" });
	});

	it("rejects the same truncated payload at execution finalization", () => {
		expect(() => parseFinalToolArguments('{"path":"src/app')).toThrow(/truncated or malformed/i);
	});

	it("parses complete arguments without changing their values", () => {
		expect(parseFinalToolArguments('{"path":"src/app.ts","content":"ok"}')).toEqual({
			path: "src/app.ts",
			content: "ok",
		});
	});

	it("preserves the existing invalid-escape repair for complete JSON", () => {
		expect(parseFinalToolArguments(String.raw`{"path":"A\H"}`)).toEqual({ path: String.raw`A\H` });
	});

	it("allows empty arguments for tools without parameters", () => {
		expect(parseFinalToolArguments("")).toEqual({});
	});
});
