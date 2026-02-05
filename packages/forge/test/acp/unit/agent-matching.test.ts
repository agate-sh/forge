import { describe, expect, test, beforeAll } from "bun:test";
import { matchAgent, getAllAgents, preloadAgents } from "../../../src/acp/agents.js";

// Preload agents before tests run
beforeAll(async () => {
	await preloadAgents();
});

describe("matchAgent", () => {
	test("exact match (case-insensitive)", () => {
		const result = matchAgent("Claude Code");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.match.name).toBe("Claude Code");
		}
	});

	test("exact match with lowercase", () => {
		const result = matchAgent("claude code");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.match.name).toBe("Claude Code");
		}
	});

	test("fuzzy match - 'claude' matches 'Claude Code'", () => {
		const result = matchAgent("claude");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.match.name).toBe("Claude Code");
		}
	});

	test("fuzzy match - 'gemini' matches 'Gemini CLI'", () => {
		const result = matchAgent("gemini");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.match.name).toBe("Gemini CLI");
		}
	});

	test("ambiguous match - 'cli' matches multiple agents", () => {
		const result = matchAgent("cli");
		expect(result.success).toBe(false);
		if (!result.success && result.error === "ambiguous") {
			expect(result.matches.length).toBeGreaterThan(1);
			const matchNames = result.matches.map((a) => a.name);
			expect(matchNames).toContain("Gemini CLI");
		}
	});

	test("not found - 'invalid' doesn't match any agent", () => {
		const result = matchAgent("invalid");
		expect(result.success).toBe(false);
		if (!result.success && result.error === "not-found") {
			expect(result.available).toEqual(getAllAgents());
		}
	});

	test("empty string returns not-found", () => {
		const result = matchAgent("");
		expect(result.success).toBe(false);
		if (!result.success && result.error === "not-found") {
			expect(result.available).toEqual(getAllAgents());
		}
	});
});
