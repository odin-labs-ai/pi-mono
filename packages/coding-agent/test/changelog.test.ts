import { describe, expect, test } from "vitest";
import {
	type ChangelogEntry,
	getChangelogVersion,
	getNewEntries,
	normalizeChangelogLinks,
} from "../src/utils/changelog.ts";

const entry: ChangelogEntry = {
	version: "0.79.0",
	major: 0,
	minor: 79,
	patch: 0,
	content: "",
};

describe("normalizeChangelogLinks", () => {
	test("rewrites package-relative changelog links to tag-pinned GitHub source links", () => {
		const markdown = [
			"[Project Trust](README.md#project-trust)",
			"[Extensions](docs/extensions.md#project_trust)",
			"[Examples](examples/extensions/)",
			"[Root README](../../README.md#supply-chain-hardening)",
		].join("\n");

		expect(normalizeChangelogLinks(markdown, entry)).toBe(
			[
				"[Project Trust](https://github.com/odin-labs-ai/pi-mono/blob/v0.79.0/packages/coding-agent/README.md#project-trust)",
				"[Extensions](https://github.com/odin-labs-ai/pi-mono/blob/v0.79.0/packages/coding-agent/docs/extensions.md#project_trust)",
				"[Examples](https://github.com/odin-labs-ai/pi-mono/tree/v0.79.0/packages/coding-agent/examples/extensions/)",
				"[Root README](https://github.com/odin-labs-ai/pi-mono/blob/v0.79.0/README.md#supply-chain-hardening)",
			].join("\n"),
		);
	});

	test("keeps Odin prerelease tags in generated links", () => {
		expect(
			normalizeChangelogLinks("[README](README.md)", {
				version: "0.79.10-odin.1",
				major: 0,
				minor: 79,
				patch: 10,
				content: "",
			}),
		).toBe("[README](https://github.com/odin-labs-ai/pi-mono/blob/v0.79.10-odin.1/packages/coding-agent/README.md)");
	});

	test("canonicalizes old repository URLs without changing external links", () => {
		const markdown = [
			"[#5167](https://github.com/earendil-works/pi-mono/pull/5167)",
			"[#4163](https://github.com/badlogic/pi-mono/issues/4163)",
			"[Agent README](https://github.com/badlogic/pi-mono/blob/main/packages/agent/README.md)",
			"[External](https://example.com/docs)",
			"[Local anchor](#settings)",
		].join("\n");

		expect(normalizeChangelogLinks(markdown, "0.79.0")).toBe(
			[
				"[#5167](https://github.com/odin-labs-ai/pi-mono/pull/5167)",
				"[#4163](https://github.com/odin-labs-ai/pi-mono/issues/4163)",
				"[Agent README](https://github.com/odin-labs-ai/pi-mono/blob/v0.79.0/packages/agent/README.md)",
				"[External](https://example.com/docs)",
				"[Local anchor](#settings)",
			].join("\n"),
		);
	});
});

describe("Odin changelog lineage", () => {
	const odinEntry: ChangelogEntry = {
		version: "0.79.10-odin.1",
		major: 0,
		minor: 79,
		patch: 10,
		content: "## [0.79.10-odin.1] - 2026-10-03",
	};
	const upstreamEntry: ChangelogEntry = {
		version: "0.79.10",
		major: 0,
		minor: 79,
		patch: 10,
		content: "## [0.79.10] - 2026-06-22",
	};

	test("uses changelog order when migrating from the same upstream base version", () => {
		expect(getNewEntries([odinEntry, upstreamEntry], "0.79.10")).toEqual([odinEntry]);
		expect(getNewEntries([odinEntry, upstreamEntry], "0.79.10-odin.1")).toEqual([]);
	});

	test("preserves the full Odin prerelease in collapsed notices", () => {
		expect(getChangelogVersion(odinEntry.content)).toBe("0.79.10-odin.1");
	});
});
