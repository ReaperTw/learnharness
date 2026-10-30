export const LOCALES = ["zh-TW", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "zh-TW";
export const LOCALE_STORAGE_KEY = "learnharness.locale";

let runtimeLocale: Locale | undefined;
export function setRuntimeLocale(locale: Locale): void {
	runtimeLocale = locale;
}

export function isLocale(value: unknown): value is Locale {
	return value === "zh-TW" || value === "en";
}

/** Device preference, also usable by the non-React session transport. */
export function getLocale(): Locale {
	if (typeof window === "undefined") return DEFAULT_LOCALE;
	if (runtimeLocale) return runtimeLocale;
	try {
		const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
		if (isLocale(value)) return value;
	} catch { /* Storage can be unavailable in private or restricted contexts. */ }
	return typeof document !== "undefined" && isLocale(document.documentElement.lang) ? document.documentElement.lang : DEFAULT_LOCALE;
}

export function responseLanguageInstruction(locale: Locale): string {
	const language = locale === "en" ? "English" : "Traditional Chinese as used in Taiwan (繁體中文，台灣用語; never Simplified Chinese)";
	return `Preferred learner language: ${language}. Use this language by default for teaching, questions, quizzes, practice problems, feedback, plan labels, and learner-facing tool content. Follow an explicit learner request for another language. Preserve code, mathematical notation, identifiers, proper names, and quoted source material; do not translate tool names or schema keys.`;
}
