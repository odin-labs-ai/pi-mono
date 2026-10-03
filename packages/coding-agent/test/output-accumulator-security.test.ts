import { rmSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OutputAccumulator } from "../src/core/tools/output-accumulator.ts";

describe("OutputAccumulator security", () => {
	it("creates spill files with owner-only permissions", async () => {
		const output = new OutputAccumulator({ maxBytes: 1, tempFilePrefix: "pi-output-permissions" });
		output.append(Buffer.from("secret output"));
		output.finish();
		const path = output.snapshot({ persistIfTruncated: true }).fullOutputPath;
		expect(path).toBeDefined();

		await output.closeTempFile();
		try {
			expect(statSync(path!).mode & 0o777).toBe(0o600);
		} finally {
			rmSync(path!, { force: true });
		}
	});
});
