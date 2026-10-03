import type { SettingsManager } from "./settings-manager.ts";

function isTruthyEnvFlag(value: string | undefined): boolean {
	if (!value) return false;
	return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

export function isProviderAttributionEnabled(
	settingsManager: SettingsManager,
	attributionEnv: string | undefined = process.env.PI_PROVIDER_ATTRIBUTION,
	legacyTelemetryEnv: string | undefined = process.env.PI_TELEMETRY,
): boolean {
	const envValue = attributionEnv ?? legacyTelemetryEnv;
	return envValue !== undefined ? isTruthyEnvFlag(envValue) : settingsManager.getEnableProviderAttribution();
}
