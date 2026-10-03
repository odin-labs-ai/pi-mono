import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DefaultPackageManager } from "../src/core/package-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";

describe("Package Manager git source parsing", () => {
	let tempDir: string;
	let agentDir: string;
	let settingsManager: SettingsManager;
	let packageManager: DefaultPackageManager;

	beforeEach(() => {
		tempDir = join(tmpdir(), `pm-ssh-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });
		agentDir = join(tempDir, "agent");
		mkdirSync(agentDir, { recursive: true });

		settingsManager = SettingsManager.inMemory();
		packageManager = new DefaultPackageManager({
			cwd: tempDir,
			agentDir,
			settingsManager,
		});
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	describe("protocol URLs without git: prefix", () => {
		it("should parse https:// URL", () => {
			const parsed = (packageManager as any).parseSource("https://github.com/user/repo");
			expect(parsed.type).toBe("git");
			expect(parsed.host).toBe("github.com");
			expect(parsed.path).toBe("user/repo");
		});

		it("should parse ssh:// URL", () => {
			const parsed = (packageManager as any).parseSource("ssh://git@github.com/user/repo");
			expect(parsed.type).toBe("git");
			expect(parsed.host).toBe("github.com");
			expect(parsed.path).toBe("user/repo");
			expect(parsed.repo).toBe("ssh://git@github.com/user/repo");
		});
	});

	describe("shorthand URLs with git: prefix", () => {
		it("should parse git@host:path format", () => {
			const parsed = (packageManager as any).parseSource("git:git@github.com:user/repo");
			expect(parsed.type).toBe("git");
			expect(parsed.host).toBe("github.com");
			expect(parsed.path).toBe("user/repo");
			expect(parsed.repo).toBe("git@github.com:user/repo");
			expect(parsed.pinned).toBe(false);
		});

		it("should parse host/path shorthand", () => {
			const parsed = (packageManager as any).parseSource("git:github.com/user/repo");
			expect(parsed.type).toBe("git");
			expect(parsed.host).toBe("github.com");
			expect(parsed.path).toBe("user/repo");
		});

		it("should parse shorthand with ref", () => {
			const parsed = (packageManager as any).parseSource("git:git@github.com:user/repo@v1.0.0");
			expect(parsed.type).toBe("git");
			expect(parsed.ref).toBe("v1.0.0");
			expect(parsed.pinned).toBe(true);
		});

		it("should reject option-like refs instead of treating them as local paths", () => {
			for (const source of [
				"git:github.com/user/repo@--upload-pack=payload",
				"git:github.com/user/repo@%2D%2Dupload-pack%3Dpayload",
				"git:git@github.com:user/repo@-c=core.sshCommand=payload",
			]) {
				expect(() => (packageManager as any).parseSource(source)).toThrow("Invalid git source");
			}
		});

		it("separates validated clone and ref operands from git options", async () => {
			const source = (packageManager as any).parseSource("git:github.com/user/repo@v1.2.3");
			const runCommand = vi.spyOn(packageManager as any, "runCommand").mockResolvedValue(undefined);

			await (packageManager as any).installGit(source, "temporary");

			expect(runCommand.mock.calls[0]?.[0]).toBe("git");
			expect(runCommand.mock.calls[0]?.[1]).toEqual([
				"clone",
				"--",
				"https://github.com/user/repo",
				expect.stringContaining("/user/repo"),
			]);
			expect(runCommand.mock.calls[1]?.[1]).toEqual(["checkout", "--detach", "v1.2.3", "--"]);
		});
	});

	describe("unsupported without git: prefix", () => {
		it("should treat git@host:path as local without git: prefix", () => {
			const parsed = (packageManager as any).parseSource("git@github.com:user/repo");
			expect(parsed.type).toBe("local");
		});

		it("should treat host/path shorthand as local without git: prefix", () => {
			const parsed = (packageManager as any).parseSource("github.com/user/repo");
			expect(parsed.type).toBe("local");
		});
	});

	describe("identity normalization", () => {
		it("should normalize protocol and shorthand-prefixed URLs to same identity", () => {
			const prefixed = (packageManager as any).getPackageIdentity("git:git@github.com:user/repo");
			const https = (packageManager as any).getPackageIdentity("https://github.com/user/repo");
			const ssh = (packageManager as any).getPackageIdentity("ssh://git@github.com/user/repo");

			expect(prefixed).toBe("git:github.com/user/repo");
			expect(prefixed).toBe(https);
			expect(prefixed).toBe(ssh);
		});
	});
});
