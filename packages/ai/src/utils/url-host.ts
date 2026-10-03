/**
 * Match an HTTP endpoint by DNS label boundary rather than by URL substring.
 * Exact hosts and their subdomains match; lookalike suffixes do not.
 */
export function urlHostnameMatches(value: string, expectedHost: string): boolean {
	try {
		const hostname = new URL(value).hostname.toLowerCase();
		const normalizedExpectedHost = expectedHost.toLowerCase();
		return hostname === normalizedExpectedHost || hostname.endsWith(`.${normalizedExpectedHost}`);
	} catch {
		return false;
	}
}
