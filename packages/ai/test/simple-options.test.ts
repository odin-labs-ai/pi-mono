import { describe, expect, it } from "vitest";
import { resolveMaxTokens } from "../src/providers/simple-options.ts";

describe("provider output cap resolution", () => {
	const model = { maxTokens: 128_000 };

	it("puts the advertised model cap on the wire by default", () => {
		expect(resolveMaxTokens(model)).toBe(128_000);
	});

	it("preserves a lower explicit caller cap", () => {
		expect(resolveMaxTokens(model, 8_192)).toBe(8_192);
	});

	it("clamps an explicit request to the advertised model cap", () => {
		expect(resolveMaxTokens(model, 200_000)).toBe(128_000);
	});
});
