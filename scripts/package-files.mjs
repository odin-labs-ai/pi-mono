#!/usr/bin/env node

import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CODING_AGENT_PACKAGE = "@odinlabs-ai/pi-coding-agent";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function copyFile(source, destination) {
	mkdirSync(dirname(destination), { recursive: true });
	copyFileSync(source, destination);
}

function copyFilesWithExtension(sourceDir, extension, destinationDir) {
	const names = readdirSync(sourceDir, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(extension))
		.map((entry) => entry.name)
		.sort();
	if (names.length === 0) {
		throw new Error(`No ${extension} files found in ${sourceDir}`);
	}
	for (const name of names) {
		copyFile(join(sourceDir, name), join(destinationDir, name));
	}
}

function removeFilesWithExtension(directory, extension) {
	if (!existsSync(directory)) return;
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (entry.isFile() && entry.name.endsWith(extension)) {
			rmSync(join(directory, entry.name), { force: true });
		}
	}
}

function resolvePackageDir(packagePath) {
	if (!packagePath || isAbsolute(packagePath)) {
		throw new Error("A repository-relative package path is required");
	}
	const packageDir = resolve(REPO_ROOT, packagePath);
	const repoRelative = relative(REPO_ROOT, packageDir);
	if (repoRelative === "" || repoRelative.startsWith("..")) {
		throw new Error(`Package path must remain inside ${REPO_ROOT}`);
	}
	return packageDir;
}

function assertCodingAgentPackage(packageDir) {
	const manifestPath = join(packageDir, "package.json");
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	if (manifest.name !== CODING_AGENT_PACKAGE) {
		throw new Error(`Expected ${CODING_AGENT_PACKAGE} at ${packageDir}, found ${manifest.name ?? "unnamed package"}`);
	}
}

export function cleanPackage(packageDir = process.cwd()) {
	rmSync(join(packageDir, "dist"), { force: true, recursive: true });
}

export function makeCodingAgentCliExecutable(packageDir = process.cwd(), platform = process.platform) {
	assertCodingAgentPackage(packageDir);
	if (platform === "win32") return;
	chmodSync(join(packageDir, "dist", "cli.js"), 0o755);
}

export function copyCodingAgentAssets(packageDir = process.cwd()) {
	assertCodingAgentPackage(packageDir);
	const themeDestination = join(packageDir, "dist", "modes", "interactive", "theme");
	removeFilesWithExtension(themeDestination, ".json");
	copyFilesWithExtension(
		join(packageDir, "src", "modes", "interactive", "theme"),
		".json",
		themeDestination,
	);
	const exportSource = join(packageDir, "src", "core", "export-html");
	const exportDestination = join(packageDir, "dist", "core", "export-html");
	for (const name of ["template.html", "template.css", "template.js"]) {
		copyFile(join(exportSource, name), join(exportDestination, name));
	}
	const vendorDestination = join(exportDestination, "vendor");
	removeFilesWithExtension(vendorDestination, ".js");
	copyFilesWithExtension(join(exportSource, "vendor"), ".js", vendorDestination);
}

export function copyCodingAgentBinaryAssets(packageDir = process.cwd()) {
	assertCodingAgentPackage(packageDir);
	const distDir = join(packageDir, "dist");
	for (const name of ["package.json", "README.md", "CHANGELOG.md"]) {
		copyFile(join(packageDir, name), join(distDir, name));
	}
	const themeDestination = join(distDir, "theme");
	removeFilesWithExtension(themeDestination, ".json");
	copyFilesWithExtension(
		join(packageDir, "src", "modes", "interactive", "theme"),
		".json",
		themeDestination,
	);
	const exportSource = join(packageDir, "src", "core", "export-html");
	copyFile(join(exportSource, "template.html"), join(distDir, "export-html", "template.html"));
	const vendorDestination = join(distDir, "export-html", "vendor");
	removeFilesWithExtension(vendorDestination, ".js");
	copyFilesWithExtension(join(exportSource, "vendor"), ".js", vendorDestination);
	for (const name of ["docs", "examples"]) {
		rmSync(join(distDir, name), { force: true, recursive: true });
		cpSync(join(packageDir, name), join(distDir, name), { recursive: true });
	}
	copyFile(
		resolve(packageDir, "..", "..", "node_modules", "@silvia-odwyer", "photon-node", "photon_rs_bg.wasm"),
		join(distDir, "photon_rs_bg.wasm"),
	);
}

export function runCommand(command, packagePath) {
	const packageDir = resolvePackageDir(packagePath);
	switch (command) {
		case "clean":
			cleanPackage(packageDir);
			break;
		case "chmod-cli":
			makeCodingAgentCliExecutable(packageDir);
			break;
		case "copy-coding-assets":
			copyCodingAgentAssets(packageDir);
			break;
		case "copy-coding-binary-assets":
			copyCodingAgentBinaryAssets(packageDir);
			break;
		default:
			throw new Error(
				`Usage: ${basename(process.argv[1])} <clean|chmod-cli|copy-coding-assets|copy-coding-binary-assets>`,
			);
	}
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) {
	runCommand(process.argv[2], process.argv[3]);
}
