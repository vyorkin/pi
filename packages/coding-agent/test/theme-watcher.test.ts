import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initTheme, setTheme, stopThemeWatcher, theme } from "../src/modes/interactive/theme/theme.ts";

const DARK_THEME = JSON.parse(
	readFileSync(new URL("../src/modes/interactive/theme/dark.json", import.meta.url), "utf-8"),
) as { name: string };

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	throw new Error("Timed out waiting for condition");
}

afterEach(() => {
	stopThemeWatcher();
	initTheme("dark");
	vi.unstubAllEnvs();
});

describe("theme watcher", () => {
	it("loads a custom theme whose file appears after startup", async () => {
		const agentDir = mkdtempSync(join(tmpdir(), "pi-theme-watch-"));
		vi.stubEnv("PI_CODING_AGENT_DIR", agentDir);
		const themesDir = join(agentDir, "themes");
		mkdirSync(themesDir, { recursive: true });
		const themeFile = join(themesDir, "late.json");

		try {
			// Missing at startup: fall back, but keep watching the requested custom theme.
			initTheme("late", true);
			expect(theme.name).not.toBe("late");

			// The file appears later, so the watcher should pick it up without a restart.
			writeFileSync(themeFile, JSON.stringify({ ...DARK_THEME, name: "late" }));
			await waitFor(() => theme.name === "late");
			expect(theme.name).toBe("late");
		} finally {
			rmSync(agentDir, { recursive: true, force: true });
		}
	});

	it("keeps watching when setTheme fails for a missing custom theme", async () => {
		const agentDir = mkdtempSync(join(tmpdir(), "pi-theme-watch-set-"));
		vi.stubEnv("PI_CODING_AGENT_DIR", agentDir);
		const themesDir = join(agentDir, "themes");
		mkdirSync(themesDir, { recursive: true });
		const themeFile = join(themesDir, "late-set.json");

		try {
			// This is the path InteractiveThemeController uses for the configured theme.
			const result = setTheme("late-set", true);
			expect(result.success).toBe(false);
			expect(theme.name).not.toBe("late-set");

			writeFileSync(themeFile, JSON.stringify({ ...DARK_THEME, name: "late-set" }));
			await waitFor(() => theme.name === "late-set");
			expect(theme.name).toBe("late-set");
		} finally {
			rmSync(agentDir, { recursive: true, force: true });
		}
	});
});
