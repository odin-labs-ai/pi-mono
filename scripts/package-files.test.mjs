import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";
import {
	cleanPackage,
	copyCodingAgentAssets,
	copyCodingAgentBinaryAssets,
	makeCodingAgentCliExecutable,
	runCommand,
} from "./package-files.mjs";

const tempRoot = mkdtempSync(join(tmpdir(), "pi-package-files-"));
after(() => rmSync(tempRoot, { force: true, recursive: true }));

let packageDir;

function write(relativePath, contents = relativePath) {
	const destination = join(packageDir, relativePath);
	mkdirSync(join(destination, ".."), { recursive: true });
	writeFileSync(destination, contents);
}

beforeEach(() => {
	packageDir = join(tempRoot, `case-${Date.now()}-${Math.random()}`, "packages", "coding-agent");
	mkdirSync(packageDir, { recursive: true });
	write("package.json", JSON.stringify({ name: "@odinlabs-ai/pi-coding-agent" }));
	write("README.md");
	write("CHANGELOG.md");
	write("src/modes/interactive/theme/dark.json");
	write("src/modes/interactive/theme/light.json");
	write("src/core/export-html/template.html");
	write("src/core/export-html/template.css");
	write("src/core/export-html/template.js");
	write("src/core/export-html/vendor/highlight.js");
	write("docs/index.md");
	write("docs/nested/guide.md");
	write("examples/example.ts");
	write("examples/nested/example.ts");
	write("../../node_modules/@silvia-odwyer/photon-node/photon_rs_bg.wasm", "wasm");
});

test("cleanPackage removes only the package dist directory", () => {
	write("dist/stale.txt");
	cleanPackage(packageDir);
	assert.equal(existsSync(join(packageDir, "dist")), false);
	assert.equal(existsSync(join(packageDir, "package.json")), true);
});

test("copyCodingAgentAssets copies runtime themes and HTML exporter assets", () => {
	write("dist/modes/interactive/theme/stale.json", "stale");
	write("dist/modes/interactive/theme/theme.js", "compiled");
	write("dist/core/export-html/vendor/stale.js", "stale");
	copyCodingAgentAssets(packageDir);
	for (const relativePath of [
		"dist/modes/interactive/theme/dark.json",
		"dist/modes/interactive/theme/light.json",
		"dist/core/export-html/template.html",
		"dist/core/export-html/template.css",
		"dist/core/export-html/template.js",
		"dist/core/export-html/vendor/highlight.js",
	]) {
		assert.equal(readFileSync(join(packageDir, relativePath), "utf8"), relativePath.replace(/^dist\//, "src/"));
	}
	assert.equal(existsSync(join(packageDir, "dist/modes/interactive/theme/stale.json")), false);
	assert.equal(readFileSync(join(packageDir, "dist/modes/interactive/theme/theme.js"), "utf8"), "compiled");
	assert.equal(existsSync(join(packageDir, "dist/core/export-html/vendor/stale.js")), false);
});

test("copyCodingAgentBinaryAssets copies the standalone payload without a PNG directory", () => {
	write("dist/theme/stale.json", "stale");
	write("dist/export-html/vendor/stale.js", "stale");
	write("dist/docs/stale.md", "stale");
	write("dist/examples/stale.ts", "stale");
	copyCodingAgentBinaryAssets(packageDir);
	for (const relativePath of [
		"dist/package.json",
		"dist/README.md",
		"dist/CHANGELOG.md",
		"dist/theme/dark.json",
		"dist/export-html/template.html",
		"dist/export-html/vendor/highlight.js",
		"dist/docs/index.md",
		"dist/docs/nested/guide.md",
		"dist/examples/example.ts",
		"dist/examples/nested/example.ts",
		"dist/photon_rs_bg.wasm",
	]) {
		assert.equal(existsSync(join(packageDir, relativePath)), true, relativePath);
	}
	assert.equal(existsSync(join(packageDir, "dist", "assets")), false);
	assert.equal(existsSync(join(packageDir, "dist/theme/stale.json")), false);
	assert.equal(existsSync(join(packageDir, "dist/export-html/vendor/stale.js")), false);
	assert.equal(existsSync(join(packageDir, "dist/docs/stale.md")), false);
	assert.equal(existsSync(join(packageDir, "dist/examples/stale.ts")), false);
});

test("makeCodingAgentCliExecutable is platform-aware", () => {
	write("dist/cli.js", "#!/usr/bin/env node\n");
	const cliPath = join(packageDir, "dist", "cli.js");
	const initialMode = statSync(cliPath).mode;
	makeCodingAgentCliExecutable(packageDir, "win32");
	assert.equal(statSync(cliPath).mode, initialMode);

	makeCodingAgentCliExecutable(packageDir);
	if (process.platform === "win32") {
		assert.equal(statSync(cliPath).mode, initialMode);
	} else {
		assert.notEqual(statSync(cliPath).mode & 0o111, 0);
	}
});

test("asset copies fail closed when required sources are missing", () => {
	rmSync(join(packageDir, "src", "modes", "interactive", "theme"), { force: true, recursive: true });
	assert.throws(() => copyCodingAgentAssets(packageDir), /ENOENT|No \.json files/);
});

test("command dispatch rejects unknown modes and unsafe package paths", () => {
	assert.throws(() => runCommand("unknown", "packages/coding-agent"), /Usage:/);
	assert.throws(() => runCommand("clean", "../outside"), /must remain inside/);
});
