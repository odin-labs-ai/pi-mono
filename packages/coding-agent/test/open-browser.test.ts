import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeOpenBrowserTarget } from "../src/utils/open-browser.ts";

describe("normalizeOpenBrowserTarget", () => {
	it("accepts HTTP and HTTPS URLs", () => {
		expect(normalizeOpenBrowserTarget("https://example.com/login?state=abc")).toBe(
			"https://example.com/login?state=abc",
		);
		expect(normalizeOpenBrowserTarget("http://localhost:3000/callback")).toBe("http://localhost:3000/callback");
	});

	it("rejects protocols that can execute or dispatch arbitrary handlers", () => {
		expect(() => normalizeOpenBrowserTarget("javascript:alert(1)")).toThrow("Unsupported browser URL protocol");
		expect(() => normalizeOpenBrowserTarget("file:///etc/passwd")).toThrow("Unsupported browser URL protocol");
		expect(() => normalizeOpenBrowserTarget("custom-handler:payload")).toThrow("Unsupported browser URL protocol");
	});

	it("turns file paths and option-looking names into absolute paths", () => {
		expect(normalizeOpenBrowserTarget("report.html")).toBe(resolve("report.html"));
		expect(normalizeOpenBrowserTarget("--help")).toBe(resolve("--help"));
	});
});
