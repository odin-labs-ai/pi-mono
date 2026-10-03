import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const aiPackage = JSON.parse(await readFile(new URL("../packages/ai/package.json", import.meta.url), "utf8"));
const releaseScript = await readFile(new URL("release.mjs", import.meta.url), "utf8");

test("ordinary package builds use the reviewed model catalog", () => {
	assert.equal(aiPackage.scripts.build, "tsgo -p tsconfig.build.json");
	assert.equal(aiPackage.scripts.prepublishOnly, "npm run clean && npm run build");
});

test("live model generation remains an explicit maintenance command", () => {
	assert.equal(aiPackage.scripts["generate-models"], "node scripts/generate-models.ts");
	assert.equal(aiPackage.scripts["generate-image-models"], "node scripts/generate-image-models.ts");
	assert.equal(aiPackage.scripts["refresh-models"], "npm run generate-models && npm run generate-image-models");
	assert.doesNotMatch(releaseScript, /refresh-models/);
});
