#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { nextOdinVersion } from "./odin-version.mjs";

const target = process.argv[2];
if (!target) {
	console.error("Usage: node scripts/version.mjs <patch|minor|explicit-semver>");
	process.exit(1);
}

function run(command, args) {
	console.log(`$ ${[command, ...args].join(" ")}`);
	const result = spawnSync(process.platform === "win32" ? `${command}.cmd` : command, args, {
		stdio: "inherit",
	});
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

const currentVersion = JSON.parse(readFileSync("packages/ai/package.json", "utf8")).version;
let nextVersion;
try {
	nextVersion = nextOdinVersion(currentVersion, target);
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}

console.log(`Advancing Odin Pi ${currentVersion} -> ${nextVersion}`);
run("npm", ["version", nextVersion, "-ws", "--no-git-tag-version"]);
run("node", ["scripts/sync-versions.js"]);
run("npm", ["install", "--package-lock-only", "--ignore-scripts"]);
