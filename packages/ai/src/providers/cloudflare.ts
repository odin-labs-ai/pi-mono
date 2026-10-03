import type { Api, Model, ProviderEnv } from "../types.ts";
import { getProviderEnvValue } from "../utils/provider-env.ts";

/** Workers AI direct endpoint. */
export const CLOUDFLARE_WORKERS_AI_BASE_URL =
	"https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/v1";

/** AI Gateway Unified API. https://developers.cloudflare.com/ai-gateway/usage/unified-api/ */
export const CLOUDFLARE_AI_GATEWAY_COMPAT_BASE_URL =
	"https://gateway.ai.cloudflare.com/v1/{CLOUDFLARE_ACCOUNT_ID}/{CLOUDFLARE_GATEWAY_ID}/compat";

/** AI Gateway → OpenAI passthrough. Used until /compat supports /v1/responses. */
export const CLOUDFLARE_AI_GATEWAY_OPENAI_BASE_URL =
	"https://gateway.ai.cloudflare.com/v1/{CLOUDFLARE_ACCOUNT_ID}/{CLOUDFLARE_GATEWAY_ID}/openai";

/** AI Gateway → Anthropic passthrough. */
export const CLOUDFLARE_AI_GATEWAY_ANTHROPIC_BASE_URL =
	"https://gateway.ai.cloudflare.com/v1/{CLOUDFLARE_ACCOUNT_ID}/{CLOUDFLARE_GATEWAY_ID}/anthropic";

export function isCloudflareProvider(provider: string): boolean {
	return provider === "cloudflare-workers-ai" || provider === "cloudflare-ai-gateway";
}

const CLOUDFLARE_BASE_URL_PLACEHOLDERS: Record<string, ReadonlySet<string>> = {
	"cloudflare-workers-ai": new Set(["CLOUDFLARE_ACCOUNT_ID"]),
	"cloudflare-ai-gateway": new Set(["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_GATEWAY_ID"]),
};

/** Substitute known Cloudflare path-segment placeholders from provider env or process.env. */
export function resolveCloudflareBaseUrl(model: Model<Api>, env?: ProviderEnv): string {
	const url = model.baseUrl;
	if (!/[{}]/.test(url)) return url;
	const allowedPlaceholders = CLOUDFLARE_BASE_URL_PLACEHOLDERS[model.provider];
	if (!allowedPlaceholders) {
		throw new Error(`Base URL placeholders are not supported for provider ${model.provider}.`);
	}
	const baseUrl = url.replace(/\{([A-Z_][A-Z0-9_]*)\}/g, (_match, name: string) => {
		if (!allowedPlaceholders.has(name)) {
			throw new Error(`Unsupported base URL placeholder ${name} for provider ${model.provider}.`);
		}
		const value = getProviderEnvValue(name, env);
		if (!value) {
			throw new Error(`${name} is required for provider ${model.provider} but is not set.`);
		}
		return encodeURIComponent(value);
	});
	if (/[{}]/.test(baseUrl)) {
		throw new Error(`Malformed base URL placeholder for provider ${model.provider}.`);
	}
	return baseUrl;
}
