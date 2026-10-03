import { compare, valid } from "semver";
import { getPiUserAgent } from "./pi-user-agent.ts";

const LATEST_RELEASE_URL = "https://api.github.com/repos/odin-labs-ai/pi-mono/releases/latest";
const ODIN_PACKAGE_NAME = "@odinlabs-ai/pi-coding-agent";
const DEFAULT_VERSION_CHECK_TIMEOUT_MS = 10000;

export interface LatestPiRelease {
	version: string;
	packageName?: string;
	note?: string;
}

export function comparePackageVersions(leftVersion: string, rightVersion: string): number | undefined {
	const left = valid(leftVersion.trim());
	const right = valid(rightVersion.trim());
	if (!left || !right) {
		return undefined;
	}
	return compare(left, right);
}

export function isNewerPackageVersion(candidateVersion: string, currentVersion: string): boolean {
	const comparison = comparePackageVersions(candidateVersion, currentVersion);
	if (comparison !== undefined) {
		return comparison > 0;
	}
	return candidateVersion.trim() !== currentVersion.trim();
}

export async function getLatestPiRelease(
	currentVersion: string,
	options: { timeoutMs?: number } = {},
): Promise<LatestPiRelease | undefined> {
	if (process.env.PI_SKIP_VERSION_CHECK || process.env.PI_OFFLINE) return undefined;

	const response = await fetch(LATEST_RELEASE_URL, {
		headers: {
			"User-Agent": getPiUserAgent(currentVersion),
			accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
		},
		signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_VERSION_CHECK_TIMEOUT_MS),
	});
	if (!response.ok) return undefined;

	const data = (await response.json()) as {
		tag_name?: unknown;
		body?: unknown;
	};
	if (typeof data.tag_name !== "string" || !data.tag_name.trim()) {
		return undefined;
	}
	const tag = data.tag_name.trim();
	const version = tag.startsWith("v") ? tag.slice(1) : tag;
	if (!valid(version)) {
		return undefined;
	}
	const note = typeof data.body === "string" && data.body.trim() ? data.body.trim() : undefined;
	return {
		version,
		packageName: ODIN_PACKAGE_NAME,
		...(note ? { note } : {}),
	};
}

export async function getLatestPiVersion(
	currentVersion: string,
	options: { timeoutMs?: number } = {},
): Promise<string | undefined> {
	return (await getLatestPiRelease(currentVersion, options))?.version;
}

export async function checkForNewPiVersion(currentVersion: string): Promise<LatestPiRelease | undefined> {
	try {
		const latestRelease = await getLatestPiRelease(currentVersion);
		if (latestRelease && isNewerPackageVersion(latestRelease.version, currentVersion)) {
			return latestRelease;
		}
		return undefined;
	} catch {
		return undefined;
	}
}
