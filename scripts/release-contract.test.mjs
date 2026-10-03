import assert from "node:assert/strict";
import test from "node:test";
import { assertTagMatchesPackageVersions, versionFromReleaseTag } from "./release-contract.mjs";

test("release tags must be valid v-prefixed SemVer", () => {
	assert.equal(versionFromReleaseTag("v0.79.10-odin.1"), "0.79.10-odin.1");
	assert.throws(() => versionFromReleaseTag("0.79.10-odin.1"), /must start with v/);
	assert.throws(() => versionFromReleaseTag("vnot-semver"), /not valid SemVer/);
});

test("release tags must match every published package", () => {
	const matching = new Map([
		["@odinlabs-ai/pi-ai", "0.79.10-odin.1"],
		["@odinlabs-ai/pi-tui", "0.79.10-odin.1"],
	]);
	assert.equal(assertTagMatchesPackageVersions("v0.79.10-odin.1", matching), "0.79.10-odin.1");

	const mismatched = new Map(matching);
	mismatched.set("@odinlabs-ai/pi-tui", "0.79.10-odin.2");
	assert.throws(() => assertTagMatchesPackageVersions("v0.79.10-odin.1", mismatched), /does not match/);
});
