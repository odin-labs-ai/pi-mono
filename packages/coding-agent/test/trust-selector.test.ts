import { setKeybindings } from "@odinlabs-ai/pi-tui";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KeybindingsManager } from "../src/core/keybindings.ts";
import { TrustSelectorComponent } from "../src/modes/interactive/components/trust-selector.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

describe("TrustSelectorComponent", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	beforeEach(() => {
		setKeybindings(new KeybindingsManager());
	});

	it("marks the saved trusted decision", () => {
		const selector = new TrustSelectorComponent({
			cwd: "/project",
			savedDecision: { path: "/project", decision: true },
			projectTrusted: true,
			onSelect: () => {},
			onCancel: () => {},
		});

		const output = stripAnsi(selector.render(120).join("\n"));

		expect(output).toContain("Saved decision: trusted (/project)");
		expect(output).toContain("Current session: trusted");
		expect(output).toContain("Trust ✓");
		expect(output).not.toContain("Do not trust ✓");
	});

	it("defaults to a persistent denial", () => {
		const onSelect = vi.fn();
		const selector = new TrustSelectorComponent({
			cwd: "/project",
			savedDecision: null,
			projectTrusted: false,
			onSelect,
			onCancel: () => {},
		});

		selector.handleInput("\r");

		expect(onSelect).toHaveBeenCalledWith({ trusted: false, updates: [{ path: "/project", decision: false }] });
	});

	it("requires a second confirmation before granting trust", () => {
		const onSelect = vi.fn();
		const selector = new TrustSelectorComponent({
			cwd: "/project",
			savedDecision: null,
			projectTrusted: false,
			onSelect,
			onCancel: () => {},
		});

		selector.handleInput("\x1b[B");
		selector.handleInput("\r");
		expect(onSelect).not.toHaveBeenCalled();
		expect(stripAnsi(selector.render(120).join("\n"))).toContain("Trust (confirm again)");

		selector.handleInput("\r");
		expect(onSelect).toHaveBeenCalledWith({ trusted: true, updates: [{ path: "/project", decision: true }] });
	});

	it("labels saved ancestor decisions as inherited", () => {
		const selector = new TrustSelectorComponent({
			cwd: "/parent/project/nested",
			savedDecision: { path: "/parent", decision: true },
			projectTrusted: true,
			onSelect: () => {},
			onCancel: () => {},
		});

		const output = stripAnsi(selector.render(120).join("\n"));

		expect(output).toContain("Saved decision: trusted (inherited from /parent)");
	});

	it("adds a trust parent option", () => {
		const onSelect = vi.fn();
		const selector = new TrustSelectorComponent({
			cwd: "/parent/project",
			savedDecision: { path: "/parent", decision: true },
			projectTrusted: true,
			onSelect,
			onCancel: () => {},
		});

		const output = stripAnsi(selector.render(120).join("\n"));
		expect(output).toContain("Saved decision: trusted (inherited from /parent)");
		expect(output).toContain("Trust parent folder (/parent) ✓");

		selector.handleInput("\r");
		expect(onSelect).not.toHaveBeenCalled();
		selector.handleInput("\r");

		expect(onSelect).toHaveBeenCalledWith({
			trusted: true,
			updates: [
				{ path: "/parent", decision: true },
				{ path: "/parent/project", decision: null },
			],
		});
	});

	it("honors configured keys without accepting raw newline or vim fallbacks", () => {
		setKeybindings(
			new KeybindingsManager({
				"tui.select.up": "ctrl+p",
				"tui.select.down": "ctrl+n",
				"tui.select.confirm": "ctrl+x",
			}),
		);
		const onSelect = vi.fn();
		const selector = new TrustSelectorComponent({
			cwd: "/project",
			savedDecision: null,
			projectTrusted: false,
			onSelect,
			onCancel: () => {},
		});

		selector.handleInput("j");
		selector.handleInput("k");
		selector.handleInput("\n");
		expect(onSelect).not.toHaveBeenCalled();

		selector.handleInput("\x0e");
		selector.handleInput("\x18");
		selector.handleInput("\x18");
		expect(onSelect).toHaveBeenCalledWith({ trusted: true, updates: [{ path: "/project", decision: true }] });
	});
});
