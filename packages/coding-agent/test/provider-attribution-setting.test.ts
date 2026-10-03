import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isProviderAttributionEnabled } from "../src/core/provider-attribution-setting.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";

describe("provider attribution setting", () => {
	const tempRoots: string[] = [];

	afterEach(() => {
		for (const tempRoot of tempRoots.splice(0)) {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	function createSettingsManager(settings: Record<string, boolean> = {}): SettingsManager {
		const tempRoot = join(tmpdir(), `pi-provider-attribution-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		const agentDir = join(tempRoot, "agent");
		const cwd = join(tempRoot, "project");
		tempRoots.push(tempRoot);
		mkdirSync(agentDir, { recursive: true });
		mkdirSync(cwd, { recursive: true });
		writeFileSync(join(agentDir, "settings.json"), JSON.stringify(settings));
		return SettingsManager.create(cwd, agentDir);
	}

	it("preserves an existing install-telemetry opt-out as a privacy fallback", () => {
		const settingsManager = createSettingsManager({ enableInstallTelemetry: false });

		expect(settingsManager.getEnableProviderAttribution()).toBe(false);
	});

	it("prefers the new setting over the legacy privacy fallback", () => {
		const settingsManager = createSettingsManager({ enableInstallTelemetry: false, enableProviderAttribution: true });

		expect(settingsManager.getEnableProviderAttribution()).toBe(true);
	});

	it("prefers the new environment variable and falls back to the legacy variable", () => {
		const settingsManager = createSettingsManager();

		expect(isProviderAttributionEnabled(settingsManager, "1", "0")).toBe(true);
		expect(isProviderAttributionEnabled(settingsManager, undefined, "0")).toBe(false);
	});

	it("fails closed for an unrecognized environment value", () => {
		const settingsManager = createSettingsManager();

		expect(isProviderAttributionEnabled(settingsManager, "unexpected", undefined)).toBe(false);
	});
});
