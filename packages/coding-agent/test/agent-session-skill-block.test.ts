import { describe, expect, it } from "vitest";
import { parseSkillBlock } from "../src/core/agent-session.ts";

describe("parseSkillBlock", () => {
	it("parses a skill block with an optional user message", () => {
		expect(parseSkillBlock('<skill name="demo" location="/tmp/demo">\nbody\n</skill>\n\nplease continue')).toEqual({
			name: "demo",
			location: "/tmp/demo",
			content: "body",
			userMessage: "please continue",
		});
	});

	it("rejects malformed or empty headers", () => {
		expect(parseSkillBlock('<skill name="" location="/tmp/demo">\nbody\n</skill>')).toBeNull();
		expect(parseSkillBlock('<skill name="demo" location="">\nbody\n</skill>')).toBeNull();
		expect(parseSkillBlock('<skill name="demo" location="/tmp/demo">\nbody\n</skill>trailing')).toBeNull();
	});

	it("handles long untrusted content without regex backtracking", () => {
		const content = `${"<skill-like>".repeat(10_000)}\n</skill-like>`;
		expect(parseSkillBlock(`<skill name="demo" location="/tmp/demo">\n${content}\n</skill>`)?.content).toBe(content);
	});
});
