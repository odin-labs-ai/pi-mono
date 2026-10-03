import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadExtensions } from "../src/core/extensions/loader.ts";

describe("extension loader package aliases", () => {
	const tempRoots: string[] = [];

	afterEach(() => {
		for (const tempRoot of tempRoots.splice(0)) {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("loads extensions compiled against the immediate upstream Earendil scope", async () => {
		const tempRoot = join(tmpdir(), `pi-extension-alias-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		const extensionPath = join(tempRoot, "upstream-alias.ts");
		tempRoots.push(tempRoot);
		mkdirSync(tempRoot, { recursive: true });
		writeFileSync(
			extensionPath,
			`import { Agent } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import * as OAuth from "@earendil-works/pi-ai/oauth";
import { VERSION } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

export default function(pi) {
	void [Agent, Type, OAuth, VERSION, Text];
	pi.registerCommand("upstream-alias-loaded", { handler: async () => {} });
}`,
		);

		const result = await loadExtensions([extensionPath], tempRoot);

		expect(result.errors).toEqual([]);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].commands.keys()).toContain("upstream-alias-loaded");
	});
});
