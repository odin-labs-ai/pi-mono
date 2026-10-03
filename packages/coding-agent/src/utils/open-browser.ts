import { spawn } from "node:child_process";
import { resolve } from "node:path";

const URI_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;

export function normalizeOpenBrowserTarget(target: string): string {
	if (target.includes("\0")) {
		throw new Error("Browser target contains a NUL byte");
	}
	if (URI_SCHEME.test(target)) {
		const url = new URL(target);
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			throw new Error(`Unsupported browser URL protocol: ${url.protocol}`);
		}
		return url.toString();
	}
	return resolve(target);
}

/**
 * Open a URL or file in the platform browser/default handler.
 *
 * This intentionally never invokes a shell. On Windows, do not use
 * `cmd /c start`: cmd.exe re-parses metacharacters (&, |, ^, ...) before
 * `start` runs, which would make attacker-controlled URLs injectable.
 */
export function openBrowser(target: string): void {
	const safeTarget = normalizeOpenBrowserTarget(target);
	const [cmd, args]: [string, string[]] =
		process.platform === "darwin"
			? ["open", ["--", safeTarget]]
			: process.platform === "win32"
				? ["rundll32", ["url.dll,FileProtocolHandler", safeTarget]]
				: ["xdg-open", [safeTarget]];

	// spawn reports launcher failures (for example, missing xdg-open) via an
	// error event. Browser launch is best-effort: callers still present the target
	// to the user, so keep the launcher failure from becoming a process crash.
	spawn(cmd, args, { stdio: "ignore", detached: true })
		.on("error", () => {})
		.unref();
}
