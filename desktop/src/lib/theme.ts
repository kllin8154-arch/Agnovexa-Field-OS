import { useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "agnovexa.opsdesk.theme.v1";
const EVENT_NAME = "agnovexa:theme-change";

function systemTheme(prefersDark?: boolean): ResolvedTheme {
  if (typeof prefersDark === "boolean") return prefersDark ? "dark" : "light";
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function loadThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

export function resolveTheme(
  preference = loadThemePreference(),
  prefersDark?: boolean,
): ResolvedTheme {
  return preference === "system" ? systemTheme(prefersDark) : preference;
}

function apply(preference: ThemePreference): void {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolved;
}

export function setThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, preference);
  apply(preference);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (loadThemePreference() === "system") apply("system");
    listener();
  };
  window.addEventListener(EVENT_NAME, onChange);
  window.addEventListener("storage", onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(EVENT_NAME, onChange);
    window.removeEventListener("storage", onChange);
    media.removeEventListener("change", onChange);
  };
}

function snapshot(): string {
  const preference = loadThemePreference();
  return `${preference}:${resolveTheme(preference)}`;
}

export function useTheme(): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
} {
  useSyncExternalStore(subscribe, snapshot, () => "system:dark");
  const preference = loadThemePreference();
  return { preference, resolved: resolveTheme(preference), setPreference: setThemePreference };
}

apply(loadThemePreference());
