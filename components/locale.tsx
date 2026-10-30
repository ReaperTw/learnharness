"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_LOCALE, getLocale, isLocale, LOCALE_STORAGE_KEY, setRuntimeLocale, type Locale } from "@/src/core/locale";
import { uiTranslations } from "@/components/ui-translations";
import { settingsTranslations } from "@/components/settings-translations";

export type { Locale } from "@/src/core/locale";
type Values = Record<string, string | number>;
const translations: Record<string, string> = {
	...uiTranslations, ...settingsTranslations,
	"Could not save language preference. This change may not survive a restart.": "無法儲存語言偏好，重新啟動後可能會還原。",
	"Could not load language preference.": "無法載入語言偏好。",
};

// Existing transports expose string errors; match only app-owned envelopes.
const errorTranslations: readonly (readonly [RegExp, string])[] = [
	[/^Import request failed \(HTTP (\d+)\)(.*)\. Please retry the file\.$/s, "匯入請求失敗（HTTP $1）$2。請重試此檔案。"],
	[/^Delete failed \((\d+)\)$/, "刪除失敗（$1）"],
	[/^Save failed \((\d+)\)$/, "儲存失敗（$1）"],
	[/^settings rejected \((\d+)\)$/, "設定遭拒（$1）"],
	[/^Save failed: (.*)$/s, "儲存失敗：$1"],
	[/^The (send|steer|dismissal) failed \((\d+)\)\.$/, "操作失敗（$2）。"],
	[/^No (.+) key is set — add one in Settings → Keys$/, "尚未設定 $1 金鑰，請在「設定 → 服務提供者」新增。"],
];

const activityLabels: Record<string, true> = {
	starting: true, failed: true, researching: true, "building demo": true, "drawing figure": true,
	"reading pdf": true, aborted: true, "recovering: re-running": true, "needs model setup": true, "needs a provider key": true,
};
export function localizeActivity(source: string, t: (source: string) => string): string {
	return Object.hasOwn(activityLabels, source) ? t(source) : source;
}

export function translate(source: string, locale: Locale = getLocale(), values?: Values): string {
	let text = locale === "zh-TW" && Object.hasOwn(translations, source) ? (translations[source] ?? source) : source;
	if (locale === "zh-TW" && text === source) {
		for (const [pattern, replacement] of errorTranslations) {
			if (pattern.test(source)) { text = source.replace(pattern, replacement); break; }
		}
	}
	return values ? text.replace(/\{(\w+)\}/g, (match, key: string) => Object.hasOwn(values, key) ? String(values[key]) : match) : text;
}

interface LocaleContextValue {
	locale: Locale;
	setLocale: (locale: Locale) => void;
	t: (source: string, values?: Values) => string;
	persistenceError: string | null;
}
const LocaleContext = createContext<LocaleContextValue>({
	locale: DEFAULT_LOCALE,
	setLocale: () => {},
	persistenceError: null,
	t: (source, values) => translate(source, DEFAULT_LOCALE, values),
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
	const [locale, updateLocale] = useState<Locale>(DEFAULT_LOCALE);
	const [persistenceError, setPersistenceError] = useState<string | null>(null);
	const revision = useRef(0);
	useEffect(() => {
		const apply = (next: Locale) => { setRuntimeLocale(next); updateLocale(next); };
		apply(getLocale());
		let alive = true;
		const startedAt = revision.current;
		if (window.lh?.getLocale) {
			void window.lh.getLocale().then((saved) => {
				if (!alive || revision.current !== startedAt || !isLocale(saved)) return;
				apply(saved);
				try { window.localStorage.setItem(LOCALE_STORAGE_KEY, saved); } catch { /* Desktop preference remains durable. */ }
			}).catch(() => { if (alive && revision.current === startedAt) setPersistenceError("Could not load language preference."); });
		}
		const sync = (event: StorageEvent) => {
			if (event.key === LOCALE_STORAGE_KEY || event.key === null) {
				revision.current++;
				apply(isLocale(event.newValue) ? event.newValue : DEFAULT_LOCALE);
			}
		};
		window.addEventListener("storage", sync);
		return () => { alive = false; window.removeEventListener("storage", sync); };
	}, []);
	const setLocale = useCallback((next: Locale) => {
		if (!isLocale(next)) return;
		const current = ++revision.current;
		setPersistenceError(null);
		setRuntimeLocale(next);
		updateLocale(next);
		try { window.localStorage.setItem(LOCALE_STORAGE_KEY, next); } catch {
			if (!window.lh?.setLocale) setPersistenceError("Could not save language preference. This change may not survive a restart.");
		}
		if (window.lh?.setLocale) void window.lh.setLocale(next).catch(() => {
			if (revision.current === current) setPersistenceError("Could not save language preference. This change may not survive a restart.");
		});
	}, []);
	useEffect(() => { document.documentElement.lang = locale; }, [locale]);
	const t = useCallback((source: string, values?: Values) => translate(source, locale, values), [locale]);
	const value = useMemo(() => ({ locale, setLocale, t, persistenceError }), [locale, setLocale, t, persistenceError]);
	return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
	return useContext(LocaleContext);
}
