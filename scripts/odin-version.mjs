import { gt, parse, valid } from "semver";

const ODIN_PRERELEASE = /^odin\.(\d+)$/;

export function nextOdinVersion(currentVersion, target) {
	const current = parse(currentVersion);
	if (!current) {
		throw new Error(`Current package version is not valid SemVer: ${currentVersion}`);
	}

	if (target === "patch") {
		const prerelease = current.prerelease.join(".");
		const odinMatch = prerelease.match(ODIN_PRERELEASE);
		if (odinMatch) {
			return `${current.major}.${current.minor}.${current.patch}-odin.${Number.parseInt(odinMatch[1], 10) + 1}`;
		}
		return `${current.major}.${current.minor}.${current.patch + 1}-odin.1`;
	}

	if (target === "minor") {
		return `${current.major}.${current.minor + 1}.0-odin.1`;
	}

	const explicit = valid(target);
	if (!explicit) {
		throw new Error("Version target must be patch, minor, or an explicit SemVer version.");
	}
	if (!gt(explicit, currentVersion)) {
		throw new Error(`Explicit version ${explicit} must be greater than current version ${currentVersion}.`);
	}
	return explicit;
}
