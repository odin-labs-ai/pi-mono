import { describe, expect, it } from "vitest";
import { resolveCloudflareBaseUrl } from "../src/providers/cloudflare.ts";
import type { Api, Model } from "../src/types.ts";

function model(provider: string, baseUrl: string): Model<Api> {
	return {
		id: "test",
		name: "Test",
		api: "openai-completions",
		provider,
		baseUrl,
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 4096,
		maxTokens: 1024,
	};
}

describe("resolveCloudflareBaseUrl", () => {
	it("substitutes only the documented provider identifiers as encoded path segments", () => {
		const result = resolveCloudflareBaseUrl(
			model(
				"cloudflare-ai-gateway",
				"https://gateway.ai.cloudflare.com/v1/{CLOUDFLARE_ACCOUNT_ID}/{CLOUDFLARE_GATEWAY_ID}/compat",
			),
			{
				CLOUDFLARE_ACCOUNT_ID: "account/with/slash",
				CLOUDFLARE_GATEWAY_ID: "gateway?admin=true",
			},
		);

		expect(result).toBe("https://gateway.ai.cloudflare.com/v1/account%2Fwith%2Fslash/gateway%3Fadmin%3Dtrue/compat");
	});

	it("rejects arbitrary environment placeholders", () => {
		expect(() =>
			resolveCloudflareBaseUrl(model("cloudflare-workers-ai", "https://example.test/{AWS_SECRET_ACCESS_KEY}"), {
				AWS_SECRET_ACCESS_KEY: "secret",
			}),
		).toThrow("Unsupported base URL placeholder AWS_SECRET_ACCESS_KEY");
	});

	it("rejects malformed placeholders instead of leaving them in the URL", () => {
		expect(() =>
			resolveCloudflareBaseUrl(model("cloudflare-workers-ai", "https://example.test/{cloudflare_account_id}"), {}),
		).toThrow("Malformed base URL placeholder");
	});
});
