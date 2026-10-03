import { describe, expect, it } from "vitest";
import { applyEditsToNormalizedContent } from "../src/core/tools/edit-diff.ts";

describe("fuzzy edit byte preservation", () => {
	it("preserves same-line bytes outside the replaced span", () => {
		const original = "keep “quoted” and 5²; target — old; keep ﬁle\n";
		const { baseContent, newContent } = applyEditsToNormalizedContent(
			original,
			[{ oldText: "target - old", newText: "target - new" }],
			"doc.md",
		);

		expect(baseContent).toBe(original);
		expect(newContent).toBe("keep “quoted” and 5²; target - new; keep ﬁle\n");
	});

	it("preserves a decomposed combining mark before the span", () => {
		const { newContent } = applyEditsToNormalizedContent(
			"résumé, ok — fine",
			[{ oldText: ", ok - fine", newText: ", ok - FINE" }],
			"doc.md",
		);

		expect(newContent).toBe("résumé, ok - FINE");
	});

	it("leaves a spacing mark outside the span boundary", () => {
		const { newContent } = applyEditsToNormalizedContent(
			"x — naam का rest",
			[{ oldText: "x - naam क", newText: "X - NAAM क" }],
			"doc.md",
		);

		expect(newContent).toBe("X - NAAM का rest");
	});

	it("maps a long non-identity line in bounded time", () => {
		const prefix = "café ".repeat(12_000);
		const startedAt = Date.now();
		const { newContent } = applyEditsToNormalizedContent(
			`${prefix}— mark end`,
			[{ oldText: "- mark", newText: "- MARK" }],
			"doc.md",
		);

		expect(Date.now() - startedAt).toBeLessThan(2_000);
		expect(newContent).toBe(`${prefix}- MARK end`);
	});
});
