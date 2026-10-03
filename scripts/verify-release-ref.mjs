#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { assertTagMatchesPackageVersions } from "./release-contract.mjs";

const releaseTag = process.argv[2];
if (!releaseTag || process.argv.length !== 3) {
	console.error("Usage: node scripts/verify-release-ref.mjs <release-tag>");
	process.exit(1);
}

const packageDirectories = ["ai", "agent", "tui", "coding-agent"];
const packageVersions = new Map(
	packageDirectories.map((directory) => {
		const packageJson = JSON.parse(readFileSync(`packages/${directory}/package.json`, "utf8"));
		return [packageJson.name, packageJson.version];
	}),
);

function git(args, allowFailure = false) {
	const result = spawnSync("git", args, { encoding: "utf8" });
	if (result.status !== 0 && !allowFailure) {
		throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
	}
	return result;
}

assertTagMatchesPackageVersions(releaseTag, packageVersions);

const head = git(["rev-parse", "HEAD"]).stdout.trim();
const tagCommit = git(["rev-list", "-n", "1", `refs/tags/${releaseTag}`]).stdout.trim();
if (!head || head !== tagCommit) {
	throw new Error(`Checked-out commit ${head || "<unresolved>"} does not match ${releaseTag} at ${tagCommit || "<unresolved>"}`);
}

const ancestor = git(["merge-base", "--is-ancestor", head, "refs/remotes/origin/main"], true);
if (ancestor.status !== 0) {
	throw new Error(`${releaseTag} commit ${head} is not reachable from origin/main`);
}

console.log(`${releaseTag} matches all package versions and commit ${head} on origin/main.`);
