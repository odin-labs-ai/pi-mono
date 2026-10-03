import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { basename, dirname, join, resolve, sep } from "path";
import { CONFIG_DIR_NAME } from "../config.ts";
import { parseFrontmatter } from "../utils/frontmatter.ts";
import { resolvePath } from "../utils/paths.ts";
import { createSyntheticSourceInfo, type SourceInfo } from "./source-info.ts";

/**
 * Represents a prompt template loaded from a markdown file
 */
export interface PromptTemplate {
	name: string;
	description: string;
	argumentHint?: string;
	content: string;
	sourceInfo: SourceInfo;
	filePath: string; // Absolute path to the template file
}

/**
 * Parse command arguments respecting quoted strings (bash-style)
 * Returns array of arguments
 */
export function parseCommandArgs(argsString: string): string[] {
	const args: string[] = [];
	let current = "";
	let inQuote: string | null = null;

	for (let i = 0; i < argsString.length; i++) {
		const char = argsString[i];

		if (inQuote) {
			if (char === inQuote) {
				inQuote = null;
			} else {
				current += char;
			}
		} else if (char === '"' || char === "'") {
			inQuote = char;
		} else if (/\s/.test(char)) {
			if (current) {
				args.push(current);
				current = "";
			}
		} else {
			current += char;
		}
	}

	if (current) {
		args.push(current);
	}

	return args;
}

/**
 * Substitute argument placeholders in template content
 * Supports:
 * - $1, $2, ... for positional args
 * - $@ and $ARGUMENTS for all args
 * - ${N:-default} for positional arg N with default when missing/empty
 * - ${@:N} for args from Nth onwards (bash-style slicing)
 * - ${@:N:L} for L args starting from Nth
 *
 * Note: Replacement happens on the template string only. Argument and default values
 * containing patterns like $1, $@, or $ARGUMENTS are NOT recursively substituted.
 */
export function substituteArgs(content: string, args: string[]): string {
	const allArgs = args.join(" ");
	const result: string[] = [];
	const nextClosingBrace = new Int32Array(content.length + 1);
	nextClosingBrace[content.length] = -1;
	let nearestClosingBrace = -1;
	for (let index = content.length - 1; index >= 0; index -= 1) {
		if (content.charCodeAt(index) === 125) nearestClosingBrace = index;
		nextClosingBrace[index] = nearestClosingBrace;
	}

	let cursor = 0;
	while (cursor < content.length) {
		const dollar = content.indexOf("$", cursor);
		if (dollar < 0) {
			result.push(content.slice(cursor));
			break;
		}
		result.push(content.slice(cursor, dollar));

		if (content.startsWith("$ARGUMENTS", dollar)) {
			result.push(allArgs);
			cursor = dollar + "$ARGUMENTS".length;
			continue;
		}
		if (content.startsWith("$@", dollar)) {
			result.push(allArgs);
			cursor = dollar + 2;
			continue;
		}

		let digitEnd = dollar + 1;
		while (digitEnd < content.length && content.charCodeAt(digitEnd) >= 48 && content.charCodeAt(digitEnd) <= 57) {
			digitEnd += 1;
		}
		if (digitEnd > dollar + 1) {
			result.push(args[Number(content.slice(dollar + 1, digitEnd)) - 1] ?? "");
			cursor = digitEnd;
			continue;
		}

		if (content.startsWith("${", dollar)) {
			const close = nextClosingBrace[dollar + 2] ?? -1;
			let expressionCursor = dollar + 2;
			while (
				expressionCursor < close &&
				content.charCodeAt(expressionCursor) >= 48 &&
				content.charCodeAt(expressionCursor) <= 57
			) {
				expressionCursor += 1;
			}
			if (
				expressionCursor > dollar + 2 &&
				expressionCursor + 1 < close &&
				content.startsWith(":-", expressionCursor)
			) {
				const index = Number(content.slice(dollar + 2, expressionCursor)) - 1;
				result.push(args[index] || content.slice(expressionCursor + 2, close));
				cursor = close + 1;
				continue;
			}

			if (content.startsWith("${@:", dollar)) {
				expressionCursor = dollar + 4;
				const startBegin = expressionCursor;
				while (
					expressionCursor < close &&
					content.charCodeAt(expressionCursor) >= 48 &&
					content.charCodeAt(expressionCursor) <= 57
				) {
					expressionCursor += 1;
				}
				const hasStart = expressionCursor > startBegin;
				const start = hasStart ? Math.max(0, Number(content.slice(startBegin, expressionCursor)) - 1) : 0;
				if (hasStart && expressionCursor === close) {
					result.push(args.slice(start).join(" "));
					cursor = close + 1;
					continue;
				}
				if (hasStart && content.charCodeAt(expressionCursor) === 58) {
					expressionCursor += 1;
					const lengthBegin = expressionCursor;
					while (
						expressionCursor < close &&
						content.charCodeAt(expressionCursor) >= 48 &&
						content.charCodeAt(expressionCursor) <= 57
					) {
						expressionCursor += 1;
					}
					if (expressionCursor > lengthBegin && expressionCursor === close) {
						const length = Number(content.slice(lengthBegin, expressionCursor));
						result.push(args.slice(start, start + length).join(" "));
						cursor = close + 1;
						continue;
					}
				}
			}
		}

		result.push("$");
		cursor = dollar + 1;
	}
	return result.join("");
}

function loadTemplateFromFile(filePath: string, sourceInfo: SourceInfo): PromptTemplate | null {
	try {
		const rawContent = readFileSync(filePath, "utf-8");
		const { frontmatter, body } = parseFrontmatter<Record<string, string>>(rawContent);

		const name = basename(filePath).replace(/\.md$/, "");

		// Get description from frontmatter or first non-empty line
		let description = frontmatter.description || "";
		if (!description) {
			const firstLine = body.split("\n").find((line) => line.trim());
			if (firstLine) {
				// Truncate if too long
				description = firstLine.slice(0, 60);
				if (firstLine.length > 60) description += "...";
			}
		}

		return {
			name,
			description,
			...(frontmatter["argument-hint"] && { argumentHint: frontmatter["argument-hint"] }),
			content: body,
			sourceInfo,
			filePath,
		};
	} catch {
		return null;
	}
}

/**
 * Scan a directory for .md files (non-recursive) and load them as prompt templates.
 */
function loadTemplatesFromDir(dir: string, getSourceInfo: (filePath: string) => SourceInfo): PromptTemplate[] {
	const templates: PromptTemplate[] = [];

	if (!existsSync(dir)) {
		return templates;
	}

	try {
		const entries = readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);

			// For symlinks, check if they point to a file
			let isFile = entry.isFile();
			if (entry.isSymbolicLink()) {
				try {
					const stats = statSync(fullPath);
					isFile = stats.isFile();
				} catch {
					// Broken symlink, skip it
					continue;
				}
			}

			if (isFile && entry.name.endsWith(".md")) {
				const template = loadTemplateFromFile(fullPath, getSourceInfo(fullPath));
				if (template) {
					templates.push(template);
				}
			}
		}
	} catch {
		return templates;
	}

	return templates;
}

export interface LoadPromptTemplatesOptions {
	/** Working directory for project-local templates. */
	cwd: string;
	/** Agent config directory for global templates. */
	agentDir: string;
	/** Explicit prompt template paths (files or directories). */
	promptPaths: string[];
	/** Include default prompt directories. */
	includeDefaults: boolean;
}

/**
 * Load all prompt templates from:
 * 1. Global: agentDir/prompts/
 * 2. Project: cwd/{CONFIG_DIR_NAME}/prompts/
 * 3. Explicit prompt paths
 */
export function loadPromptTemplates(options: LoadPromptTemplatesOptions): PromptTemplate[] {
	const resolvedCwd = resolvePath(options.cwd);
	const resolvedAgentDir = resolvePath(options.agentDir);
	const promptPaths = options.promptPaths;
	const includeDefaults = options.includeDefaults;

	const templates: PromptTemplate[] = [];

	const globalPromptsDir = join(resolvedAgentDir, "prompts");
	const projectPromptsDir = resolve(resolvedCwd, CONFIG_DIR_NAME, "prompts");

	const isUnderPath = (target: string, root: string): boolean => {
		const normalizedRoot = resolve(root);
		if (target === normalizedRoot) {
			return true;
		}
		const prefix = normalizedRoot.endsWith(sep) ? normalizedRoot : `${normalizedRoot}${sep}`;
		return target.startsWith(prefix);
	};

	const getSourceInfo = (resolvedPath: string): SourceInfo => {
		if (isUnderPath(resolvedPath, globalPromptsDir)) {
			return createSyntheticSourceInfo(resolvedPath, {
				source: "local",
				scope: "user",
				baseDir: globalPromptsDir,
			});
		}
		if (isUnderPath(resolvedPath, projectPromptsDir)) {
			return createSyntheticSourceInfo(resolvedPath, {
				source: "local",
				scope: "project",
				baseDir: projectPromptsDir,
			});
		}
		return createSyntheticSourceInfo(resolvedPath, {
			source: "local",
			baseDir: statSync(resolvedPath).isDirectory() ? resolvedPath : dirname(resolvedPath),
		});
	};

	if (includeDefaults) {
		templates.push(...loadTemplatesFromDir(globalPromptsDir, getSourceInfo));
		templates.push(...loadTemplatesFromDir(projectPromptsDir, getSourceInfo));
	}

	// 3. Load explicit prompt paths
	for (const rawPath of promptPaths) {
		const resolvedPath = resolvePath(rawPath, resolvedCwd, { trim: true });
		if (!existsSync(resolvedPath)) {
			continue;
		}

		try {
			const stats = statSync(resolvedPath);
			if (stats.isDirectory()) {
				templates.push(...loadTemplatesFromDir(resolvedPath, getSourceInfo));
			} else if (stats.isFile() && resolvedPath.endsWith(".md")) {
				const template = loadTemplateFromFile(resolvedPath, getSourceInfo(resolvedPath));
				if (template) {
					templates.push(template);
				}
			}
		} catch {
			// Ignore read failures
		}
	}

	return templates;
}

/**
 * Expand a prompt template if it matches a template name.
 * Returns the expanded content or the original text if not a template.
 */
export function expandPromptTemplate(text: string, templates: PromptTemplate[]): string {
	if (!text.startsWith("/")) return text;

	const match = text.match(/^\/([^\s]+)(?:\s+([\s\S]*))?$/);
	if (!match) return text;

	const templateName = match[1];
	const argsString = match[2] ?? "";

	const template = templates.find((t) => t.name === templateName);
	if (template) {
		const args = parseCommandArgs(argsString);
		return substituteArgs(template.content, args);
	}

	return text;
}
