import type { ProviderEnv } from "../types.ts";
import { getProviderEnvValue } from "./provider-env.ts";

const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000;

export function resolveStreamIdleTimeoutMs(explicit: number | undefined, env?: ProviderEnv): number {
	if (explicit !== undefined) {
		if (!Number.isFinite(explicit) || explicit < 0) {
			throw new Error(`Invalid stream idle timeout: ${String(explicit)}`);
		}
		return Math.floor(explicit);
	}

	const configured =
		getProviderEnvValue("PI_STREAM_IDLE_TIMEOUT_MS", env) ?? getProviderEnvValue("ODIN_STREAM_IDLE_TIMEOUT_MS", env);
	if (configured !== undefined) {
		const parsed = Number.parseInt(configured, 10);
		if (!Number.isFinite(parsed) || parsed < 0) {
			throw new Error(`Invalid stream idle timeout: ${configured}`);
		}
		return parsed;
	}
	return DEFAULT_STREAM_IDLE_TIMEOUT_MS;
}

export async function* withStreamIdleTimeout<T>(iterable: AsyncIterable<T>, timeoutMs: number): AsyncGenerator<T> {
	if (timeoutMs === 0) {
		yield* iterable;
		return;
	}

	const iterator = iterable[Symbol.asyncIterator]();
	while (true) {
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			const result = await Promise.race([
				iterator.next(),
				new Promise<never>((_, reject) => {
					timer = setTimeout(() => {
						try {
							void Promise.resolve(iterator.return?.()).catch(() => undefined);
						} catch {
							// Best effort: the timeout error remains authoritative.
						}
						reject(new Error(`LLM stream idle timeout after ${timeoutMs}ms`));
					}, timeoutMs);
					timer.unref?.();
				}),
			]);
			if (result.done) return;
			yield result.value;
		} finally {
			if (timer) clearTimeout(timer);
		}
	}
}

export async function readWithStreamIdleTimeout<T>(
	reader: ReadableStreamDefaultReader<T>,
	timeoutMs: number,
): Promise<Awaited<ReturnType<ReadableStreamDefaultReader<T>["read"]>>> {
	if (timeoutMs === 0) return reader.read();

	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			reader.read(),
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => {
					const error = new Error(`LLM stream idle timeout after ${timeoutMs}ms`);
					try {
						void Promise.resolve(reader.cancel(error)).catch(() => undefined);
					} catch {
						// Best effort: the timeout error remains authoritative.
					}
					reject(error);
				}, timeoutMs);
				timer.unref?.();
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}
