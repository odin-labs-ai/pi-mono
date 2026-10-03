import assert from "node:assert/strict";
import test from "node:test";
import { nextOdinVersion } from "./odin-version.mjs";

test("patch releases advance the Odin revision without collapsing to the upstream stable version", () => {
	assert.equal(nextOdinVersion("0.79.10-odin.1", "patch"), "0.79.10-odin.2");
	assert.equal(nextOdinVersion("0.79.10-odin.9", "patch"), "0.79.10-odin.10");
});

test("a stable upstream baseline starts a new Odin patch line", () => {
	assert.equal(nextOdinVersion("0.79.10", "patch"), "0.79.11-odin.1");
});

test("minor releases start the next minor Odin line", () => {
	assert.equal(nextOdinVersion("0.79.10-odin.4", "minor"), "0.80.0-odin.1");
});

test("explicit versions must be valid and newer", () => {
	assert.equal(nextOdinVersion("0.79.10-odin.1", "0.79.11-odin.1"), "0.79.11-odin.1");
	assert.throws(() => nextOdinVersion("0.79.10-odin.1", "0.79.10-odin.1"), /must be greater/);
	assert.throws(() => nextOdinVersion("0.79.10-odin.1", "major"), /must be patch, minor/);
});
