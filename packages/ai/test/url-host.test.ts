import { describe, expect, it } from "vitest";
import { urlHostnameMatches } from "../src/utils/url-host.ts";

describe("urlHostnameMatches", () => {
	it("matches exact hosts and DNS-label subdomains", () => {
		expect(urlHostnameMatches("https://api.openai.com/v1", "api.openai.com")).toBe(true);
		expect(urlHostnameMatches("https://regional.api.openai.com/v1", "api.openai.com")).toBe(true);
	});

	it("rejects lookalike suffixes, credentials, and malformed URLs", () => {
		expect(urlHostnameMatches("https://api.openai.com.evil.example/v1", "api.openai.com")).toBe(false);
		expect(urlHostnameMatches("https://api.openai.com@evil.example/v1", "api.openai.com")).toBe(false);
		expect(urlHostnameMatches("not a URL", "api.openai.com")).toBe(false);
	});
});
