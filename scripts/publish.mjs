#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const packages = [
	{ directory: "packages/ai", name: "@odinlabs-ai/pi-ai" },
	{ directory: "packages/agent", name: "@odinlabs-ai/pi-agent-core" },
	{ directory: "packages/tui", name: "@odinlabs-ai/pi-tui" },
	{ directory: "packages/coding-agent", name: "@odinlabs-ai/pi-coding-agent" },
];
const registry = "https://npm.pkg.github.com";

const dryRun = process.argv.includes("--dry-run");
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--dry-run");

if (unknownArgs.length > 0) {
	console.error(`Usage: node scripts/publish.mjs [--dry-run]`);
	process.exit(1);
}

function commandForPlatform(command) {
	return process.platform === "win32" ? `${command}.cmd` : command;
}

function run(command, args, options = {}) {
	console.log(`$ ${[command, ...args].join(" ")}`);
	const result = spawnSync(commandForPlatform(command), args, {
		cwd: options.cwd,
		encoding: "utf8",
		stdio: options.capture ? ["inherit", "pipe", "pipe"] : "inherit",
	});

	if (result.status !== 0) {
		const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
		throw new Error(output ? `Command failed: ${command} ${args.join(" ")}\n${output}` : `Command failed: ${command} ${args.join(" ")}`);
	}

	return result;
}

function readPackageJson(directory) {
	return JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
}

function assertBuildOutputExists(directory) {
	if (!existsSync(join(directory, "dist"))) {
		throw new Error(`${directory}/dist does not exist. Run npm run build before publishing.`);
	}
}

function validatePack(directory) {
	const result = run("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], { capture: true, cwd: directory });
	const packed = JSON.parse(result.stdout)[0];
	if (typeof packed?.integrity !== "string" || !packed.integrity) {
		throw new Error(`${directory}: npm pack did not report an integrity value`);
	}
	console.log(`  ${packed.filename}: ${packed.files.length} files, ${packed.size} bytes packed, ${packed.unpackedSize} bytes unpacked`);
	return packed;
}

function getPublishedIntegrity(name, version) {
	const result = spawnSync(
		commandForPlatform("npm"),
		["view", `${name}@${version}`, "dist.integrity", "--json", "--registry", registry],
		{
		encoding: "utf8",
		stdio: ["inherit", "pipe", "pipe"],
		},
	);

	if (result.status === 0 && result.stdout.trim()) {
		const integrity = JSON.parse(result.stdout);
		if (typeof integrity !== "string" || !integrity) {
			throw new Error(`${name}@${version} is published without dist.integrity`);
		}
		return integrity;
	}

	const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
	if (result.status !== 0 && (output.includes("E404") || output.includes("404 Not Found"))) {
		return undefined;
	}

	throw new Error(output ? `Failed to query ${name}@${version}\n${output}` : `Failed to query ${name}@${version}`);
}

const packageVersions = new Map();
for (const pkg of packages) {
	const packageJson = readPackageJson(pkg.directory);
	if (packageJson.name !== pkg.name) {
		throw new Error(`${pkg.directory}/package.json has name ${packageJson.name}, expected ${pkg.name}`);
	}
	packageVersions.set(pkg.name, packageJson.version);
}

const versions = [...new Set(packageVersions.values())];
if (versions.length !== 1) {
	throw new Error(`Publish packages are not lockstep versioned: ${versions.join(", ")}`);
}

console.log(`Publishing pi packages at ${versions[0]}${dryRun ? " (dry run)" : ""}\n`);

const plans = [];
for (const pkg of packages) {
	const version = packageVersions.get(pkg.name);
	assertBuildOutputExists(pkg.directory);
	const packed = validatePack(pkg.directory);
	const publishedIntegrity = getPublishedIntegrity(pkg.name, version);
	if (publishedIntegrity && publishedIntegrity !== packed.integrity) {
		throw new Error(
			`${pkg.name}@${version} is already published with different contents:\n` +
				`  local:    ${packed.integrity}\n` +
				`  registry: ${publishedIntegrity}`,
		);
	}
	plans.push({ ...pkg, packed, publishedIntegrity, version });
	console.log(
		publishedIntegrity
			? `${pkg.name}@${version} is already published with matching integrity.`
			: `${pkg.name}@${version} is not published.`,
	);
	console.log();
}

if (dryRun) process.exit(0);

for (const plan of plans) {
	if (plan.publishedIntegrity) {
		console.log(`Skipping ${plan.name}@${plan.version}: registry integrity matches\n`);
		continue;
	}

	run("npm", ["publish", "--ignore-scripts", "--registry", registry], { cwd: plan.directory });
	console.log();
}
