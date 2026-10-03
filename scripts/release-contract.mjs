import { valid } from "semver";

export function versionFromReleaseTag(tag) {
	if (typeof tag !== "string" || !tag.startsWith("v")) {
		throw new Error(`Release tag must start with v: ${tag}`);
	}
	const version = tag.slice(1);
	if (!valid(version)) {
		throw new Error(`Release tag is not valid SemVer: ${tag}`);
	}
	return version;
}

export function assertTagMatchesPackageVersions(tag, packageVersions) {
	const tagVersion = versionFromReleaseTag(tag);
	const distinctVersions = [...new Set(packageVersions.values())];
	if (distinctVersions.length !== 1 || distinctVersions[0] !== tagVersion) {
		throw new Error(
			`Release ${tag} does not match package versions: ${[...packageVersions.entries()]
				.map(([name, version]) => `${name}@${version}`)
				.join(", ")}`,
		);
	}
	return tagVersion;
}
