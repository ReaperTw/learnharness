import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";

const { readLocale, writeLocale } = createRequire(import.meta.url)("../electron/locale.cjs") as {
	readLocale(directory: string): "zh-TW" | "en";
	writeLocale(directory: string, value: unknown): void;
};

test("desktop language survives origin changes and invalid input cannot overwrite it", () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lh-language-"));
	try {
		assert.equal(readLocale(directory), "zh-TW");
		writeLocale(directory, "en");
		assert.equal(readLocale(directory), "en");
		assert.throws(() => writeLocale(directory, "zh-CN"), /Unsupported interface language/);
		assert.equal(readLocale(directory), "en");
		writeLocale(directory, "zh-TW");
		assert.equal(readLocale(directory), "zh-TW");
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
});

test("corrupt desktop preferences report a load failure instead of claiming persistence", () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lh-language-corrupt-"));
	try {
		fs.writeFileSync(path.join(directory, "locale.json"), "{");
		assert.throws(() => readLocale(directory), SyntaxError);
		writeLocale(directory, "en");
		assert.equal(readLocale(directory), "en");
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
});
