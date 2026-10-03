import { describe, expect, it, vi } from "vitest";
import {
	readWithStreamIdleTimeout,
	resolveStreamIdleTimeoutMs,
	withStreamIdleTimeout,
} from "../src/utils/stream-idle.ts";

describe("stream idle timeout", () => {
	it("uses an explicit timeout before environment defaults", () => {
		expect(resolveStreamIdleTimeoutMs(25, { PI_STREAM_IDLE_TIMEOUT_MS: "50" })).toBe(25);
		expect(resolveStreamIdleTimeoutMs(undefined, { PI_STREAM_IDLE_TIMEOUT_MS: "50" })).toBe(50);
		expect(resolveStreamIdleTimeoutMs(undefined, { ODIN_STREAM_IDLE_TIMEOUT_MS: "75" })).toBe(75);
	});

	it("rejects an async iterable that stops producing values", async () => {
		const iterable: AsyncIterable<string> = {
			[Symbol.asyncIterator]() {
				return { next: () => new Promise<IteratorResult<string>>(() => {}) };
			},
		};
		await expect(async () => {
			for await (const value of withStreamIdleTimeout(iterable, 10)) void value;
		}).rejects.toThrow(/idle timeout/i);
	});

	it("cancels a stalled reader before rejecting", async () => {
		const cancel = vi.fn();
		const reader = {
			read: () => new Promise<never>(() => {}),
			cancel,
		} as unknown as ReadableStreamDefaultReader<string>;

		await expect(readWithStreamIdleTimeout(reader, 10)).rejects.toThrow(/idle timeout/i);
		expect(cancel).toHaveBeenCalledOnce();
	});
});
