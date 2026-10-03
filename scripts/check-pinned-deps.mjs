import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dependencySections = ["dependencies", "devDependencies", "optionalDependencies"];
const exactVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const ignoredDirectories = new Set([".git", "dist", "node_modules"]);
const packageJsonFiles = [];

function collectPackageJsonFiles(directory) {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!ignoredDirectories.has(entry.name)) {
				collectPackageJsonFiles(join(directory, entry.name));
			}
			continue;
		}

		if (entry.isFile() && entry.name === "package.json") {
			packageJsonFiles.push(join(directory, entry.name));
		}
	}
}

function isNonRegistrySpecifier(specifier) {
	return /^(?:workspace:|file:|link:|portal:|git\+|github:|git:|https?:|ssh:|git:\/\/)/.test(specifier);
}

function getVersionSpecifier(specifier) {
	if (!specifier.startsWith("npm:")) return specifier;
	const aliasTarget = specifier.slice("npm:".length);
	const versionSeparator = aliasTarget.lastIndexOf("@");
	if (versionSeparator <= 0) return specifier;
	return aliasTarget.slice(versionSeparator + 1);
}

const failures = [];

collectPackageJsonFiles(".");

const workspaceVersions = new Map();
for (const file of packageJsonFiles) {
	const packageJson = JSON.parse(readFileSync(file, "utf8"));
	if (typeof packageJson.name === "string" && packageJson.name.startsWith("@odinlabs-ai/pi-")) {
		workspaceVersions.set(packageJson.name, { file, version: packageJson.version });
	}
}

const internalVersions = new Set([...workspaceVersions.values()].map(({ version }) => version));
if (internalVersions.size !== 1) {
	failures.push(
		`Odin Pi workspace packages must be lockstep versioned: ${[...workspaceVersions.entries()]
			.map(([name, { version }]) => `${name}@${version}`)
			.join(", ")}`,
	);
}

for (const file of packageJsonFiles.sort()) {
	const packageJson = JSON.parse(readFileSync(file, "utf8"));

	for (const section of dependencySections) {
		const dependencies = packageJson[section];
		if (!dependencies) continue;

		for (const [name, specifier] of Object.entries(dependencies)) {
			if (name.startsWith("@odinlabs-ai/pi-")) {
				const workspacePackage = workspaceVersions.get(name);
				if (!workspacePackage) {
					failures.push(`${file}: ${section}.${name} references an unknown Odin Pi workspace package`);
				} else if (specifier !== workspacePackage.version) {
					failures.push(
						`${file}: ${section}.${name} must exactly match ${workspacePackage.version}, found ${specifier}`,
					);
				}
				continue;
			}
			if (isNonRegistrySpecifier(specifier)) continue;
			if (exactVersionPattern.test(getVersionSpecifier(specifier))) continue;
			failures.push(`${file}: ${section}.${name} must be pinned, found ${specifier}`);
		}
	}
}

if (failures.length > 0) {
	console.error("Dependency pinning or lockstep validation failed:");
	for (const failure of failures) console.error(`  ${failure}`);
	process.exit(1);
}
