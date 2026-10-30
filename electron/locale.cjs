const fs = require("node:fs");
const path = require("node:path");

const isLocale = (value) => value === "zh-TW" || value === "en";

function readLocale(userData) {
	try {
		const value = JSON.parse(fs.readFileSync(path.join(userData, "locale.json"), "utf8"));
		return isLocale(value) ? value : "zh-TW";
	} catch (error) {
		if (error.code === "ENOENT") return "zh-TW";
		throw error;
	}
}

function writeLocale(userData, locale) {
	if (!isLocale(locale)) throw new Error("Unsupported interface language");
	fs.mkdirSync(userData, { recursive: true });
	const file = path.join(userData, "locale.json");
	fs.writeFileSync(`${file}.tmp`, JSON.stringify(locale), "utf8");
	fs.renameSync(`${file}.tmp`, file);
}

module.exports = { readLocale, writeLocale };
