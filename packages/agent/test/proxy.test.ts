import type { Api, Model } from "@odinlabs-ai/pi-ai/base";
import { afterEach, describe, expect, it, vi } from "vitest";
import { streamProxy } from "../src/proxy.ts";

describe("streamProxy", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("never serializes provider headers into the proxy request body", async () => {
		let requestBody: unknown;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_input: unknown, init?: RequestInit) => {
				requestBody = JSON.parse(String(init?.body));
				return new Response(JSON.stringify({ error: "expected test stop" }), {
					status: 500,
					headers: { "Content-Type": "application/json" },
				});
			}),
		);
		const model: Model<Api> = {
			id: "test-model",
			name: "Test Model",
			api: "openai-completions",
			provider: "test-provider",
			baseUrl: "https://provider.example/v1",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 4096,
			maxTokens: 1024,
		};

		const result = await streamProxy(model, { messages: [] }, {
			authToken: "proxy-token",
			proxyUrl: "https://proxy.example",
			headers: { Authorization: "Bearer provider-secret", "x-api-key": "provider-key" },
		} as Parameters<typeof streamProxy>[2]).result();

		expect(result.stopReason).toBe("error");
		expect(requestBody).toMatchObject({ options: {} });
		expect(JSON.stringify(requestBody)).not.toContain("provider-secret");
		expect(JSON.stringify(requestBody)).not.toContain("provider-key");
	});
});
