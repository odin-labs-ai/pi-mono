#!/usr/bin/env node
/**
 * Release script for pi-mono
 *
 * Usage:
 *   node scripts/release.mjs current [--dry-run]
 *   node scripts/release.mjs <minor|patch>
 *   node scripts/release.mjs <semver>
 *
 * Steps:
 * 1. Check for uncommitted changes
 * 2. Bump version via npm run version:xxx or set an explicit version
 * 3. Update CHANGELOG.md files: [Unreleased] -> [version] - date
 * 4. Regenerate release artifacts
 * 5. Run checks
 * 6. Commit and tag the release
 * 7. Add new [Unreleased] section to changelogs
 * 8. Commit next-cycle changelog updates
 * 9. Push main and the tag to trigger CI publishing
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { valid } from "semver";

const RELEASE_TARGET = process.argv[2];
const RELEASE_OPTIONS = process.argv.slice(3);
const BUMP_TYPES = new Set(["minor", "patch"]);
const DRY_RUN = RELEASE_OPTIONS.includes("--dry-run");

if (
	!RELEASE_TARGET ||
	(RELEASE_TARGET !== "current" && !BUMP_TYPES.has(RELEASE_TARGET) && !valid(RELEASE_TARGET)) ||
	RELEASE_OPTIONS.some((option) => option !== "--dry-run") ||
	(DRY_RUN && RELEASE_TARGET !== "current")
) {
	console.error("Usage: node scripts/release.mjs current [--dry-run] | <minor|patch|explicit-semver>");
	process.exit(1);
}

function run(cmd, options = {}) {
	console.log(`$ ${cmd}`);
	try {
		return execSync(cmd, { encoding: "utf-8", stdio: options.silent ? "pipe" : "inherit", ...options });
	} catch (e) {
		if (!options.ignoreError) {
			console.error(`Command failed: ${cmd}`);
			process.exit(1);
		}
		return null;
	}
}

function getVersion() {
	const pkg = JSON.parse(readFileSync("packages/ai/package.json", "utf-8"));
	return pkg.version;
}

function shellQuote(value) {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

function stageChangedFiles() {
	const output = run("git ls-files -m -o -d --exclude-standard", { silent: true });
	const paths = [...new Set((output || "").split("\n").map((line) => line.trim()).filter(Boolean))];
	if (paths.length === 0) {
		return;
	}

	run(`git add -- ${paths.map(shellQuote).join(" ")}`);
}

function bumpOrSetVersion(target) {
	if (BUMP_TYPES.has(target)) {
		console.log(`Bumping version (${target})...`);
		run(`npm run version:${target}`);
		return getVersion();
	}

	console.log(`Setting explicit version (${target})...`);
	run(`node scripts/version.mjs ${shellQuote(target)}`);
	return getVersion();
}

function getChangelogs() {
	const packagesDir = "packages";
	const packages = readdirSync(packagesDir);
	return packages
		.map((pkg) => join(packagesDir, pkg, "CHANGELOG.md"))
		.filter((path) => existsSync(path));
}

function updateChangelogsForRelease(version) {
	const date = new Date().toISOString().split("T")[0];
	const changelogs = getChangelogs();

	for (const changelog of changelogs) {
		const content = readFileSync(changelog, "utf-8");

		if (!content.includes("## [Unreleased]")) {
			console.log(`  Skipping ${changelog}: no [Unreleased] section`);
			continue;
		}

		const updated = content.replace(
			"## [Unreleased]",
			`## [${version}] - ${date}`
		);
		writeFileSync(changelog, updated);
		console.log(`  Updated ${changelog}`);
	}
}

function addUnreleasedSection() {
	const changelogs = getChangelogs();
	const unreleasedSection = "## [Unreleased]\n\n";

	for (const changelog of changelogs) {
		const content = readFileSync(changelog, "utf-8");

		// Insert after "# Changelog\n\n"
		const updated = content.replace(
			/^(# Changelog\n\n)/,
			`$1${unreleasedSection}`
		);
		writeFileSync(changelog, updated);
		console.log(`  Added [Unreleased] to ${changelog}`);
	}
}

function assertPreparedCurrentRelease(version) {
	if (!valid(version)) {
		console.error(`Error: current package version is not valid SemVer: ${version}`);
		process.exit(1);
	}

	for (const changelog of getChangelogs()) {
		const content = readFileSync(changelog, "utf-8");
		if (!content.includes(`## [${version}] - `)) {
			console.error(`Error: ${changelog} does not contain a prepared ${version} release section.`);
			process.exit(1);
		}
		if (!content.includes("## [Unreleased]")) {
			console.error(`Error: ${changelog} has no next-cycle [Unreleased] section.`);
			process.exit(1);
		}
	}
}

function assertReleaseHead() {
	const branch = run("git branch --show-current", { silent: true })?.trim();
	if (branch !== "main") {
		console.error(`Error: releases must run from main, not ${branch || "a detached HEAD"}.`);
		process.exit(1);
	}

	run("git fetch --quiet origin main --tags");
	const head = run("git rev-parse HEAD", { silent: true })?.trim();
	const originMain = run("git rev-parse refs/remotes/origin/main", { silent: true })?.trim();
	if (!head || !originMain || head !== originMain) {
		console.error("Error: local main must exactly match origin/main before releasing.");
		console.error(`  local:  ${head || "<unresolved>"}`);
		console.error(`  origin: ${originMain || "<unresolved>"}`);
		process.exit(1);
	}
}

// Main flow
console.log("\n=== Release Script ===\n");

// 1. Check for uncommitted changes
console.log("Checking for uncommitted changes...");
const status = run("git status --porcelain", { silent: true });
if (status && status.trim()) {
	console.error("Error: Uncommitted changes detected. Commit or stash first.");
	console.error(status);
	process.exit(1);
}
console.log("  Working directory clean\n");
assertReleaseHead();

if (RELEASE_TARGET === "current") {
	const version = getVersion();
	assertPreparedCurrentRelease(version);
	console.log(`Validating prepared release v${version}...`);
	run("npm run check");
	const postCheckStatus = run("git status --porcelain", { silent: true });
	if (postCheckStatus && postCheckStatus.trim()) {
		console.error("Error: validation changed tracked files; review and commit them before tagging.");
		console.error(postCheckStatus);
		process.exit(1);
	}
	const existingTag = run(`git rev-parse --verify ${shellQuote(`refs/tags/v${version}`)}`, {
		silent: true,
		ignoreError: true,
	});
	if (existingTag) {
		console.error(`Error: tag v${version} already exists; do not rerun the release.`);
		process.exit(1);
	}
	assertReleaseHead();
	if (DRY_RUN) {
		console.log(`=== Prepared release v${version} passed validation; no tag or push was created ===`);
		process.exit(0);
	}
	run(`git tag v${version}`);
	run(`git push --atomic origin main ${shellQuote(`refs/tags/v${version}`)}`);
	console.log(`=== Tagged prepared release v${version}; CI publishing starts after the tag push ===`);
	process.exit(0);
}

// 2. Bump or set version
const version = bumpOrSetVersion(RELEASE_TARGET);
console.log(`  New version: ${version}\n`);

// 3. Update changelogs
console.log("Updating CHANGELOG.md files...");
updateChangelogsForRelease(version);
console.log();

// 4. Regenerate release artifacts
console.log("Regenerating release artifacts...");
run("npm --prefix packages/ai run refresh-models");
run("npm run shrinkwrap:coding-agent");
console.log();

// 5. Run checks
console.log("Running checks...");
run("npm run check");
console.log();

// 6. Commit and tag
console.log("Committing and tagging...");
stageChangedFiles();
run(`git commit -m "Release v${version}"`);
run(`git tag v${version}`);
console.log();

// 7. Add new [Unreleased] sections
console.log("Adding [Unreleased] sections for next cycle...");
addUnreleasedSection();
console.log();

// 8. Commit
console.log("Committing changelog updates...");
stageChangedFiles();
run(`git commit -m "Add [Unreleased] section for next cycle"`);
console.log();

// 9. Push
console.log("Pushing to remote...");
run(`git push --atomic origin main ${shellQuote(`refs/tags/v${version}`)}`);
console.log();

console.log(`=== Prepared release v${version}; CI publishing starts after the tag push ===`);
