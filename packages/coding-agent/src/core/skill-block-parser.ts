/** Parsed skill block from a user message. */
export interface ParsedSkillBlock {
	name: string;
	location: string;
	content: string;
	userMessage: string | undefined;
}

/**
 * Parse the structural wrapper used for skill invocations in linear time.
 *
 * Keep this function self-contained: the HTML exporter serializes this exact
 * implementation into its standalone browser application.
 */
export function parseSkillBlock(text: string): ParsedSkillBlock | null {
	const prefix = '<skill name="';
	const locationSeparator = '" location="';
	const headerEnd = '">\n';
	const closing = "\n</skill>";
	if (!text.startsWith(prefix)) return null;

	const nameEnd = text.indexOf(locationSeparator, prefix.length);
	if (nameEnd <= prefix.length || text.indexOf('"', prefix.length) !== nameEnd) return null;

	const locationStart = nameEnd + locationSeparator.length;
	const locationEnd = text.indexOf(headerEnd, locationStart);
	if (locationEnd <= locationStart || text.indexOf('"', locationStart) !== locationEnd) return null;

	const contentStart = locationEnd + headerEnd.length;
	let closingStart = text.indexOf(closing, contentStart);
	while (closingStart >= 0) {
		const remainderStart = closingStart + closing.length;
		const remainderLength = text.length - remainderStart;
		if (remainderLength === 0 || (remainderLength > 2 && text.startsWith("\n\n", remainderStart))) {
			const userMessage = remainderLength === 0 ? undefined : text.slice(remainderStart + 2).trim() || undefined;
			return {
				name: text.slice(prefix.length, nameEnd),
				location: text.slice(locationStart, locationEnd),
				content: text.slice(contentStart, closingStart),
				userMessage,
			};
		}
		closingStart = text.indexOf(closing, closingStart + closing.length);
	}

	return null;
}
