import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "system" | "light" | "dark" | "custom";
export type ResolvedTheme = "light" | "dark";

export interface CustomTheme {
  schemaVersion: 1;
  name: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  textPrimary: string;
  textSecondary: string;
  outline: string;
}

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  customTheme: CustomTheme | null;
  setMode: (mode: ThemeMode) => void;
  importCustomTheme: (raw: string) => CustomTheme;
  removeCustomTheme: () => void;
}

const THEME_STORAGE_KEY = "agnovexa.opsdesk.theme.v2";
const CUSTOM_THEME_STORAGE_KEY = "agnovexa.opsdesk.custom-theme.v1";
const ThemeContext = createContext<ThemeContextValue | null>(null);

export const THEME_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  description: string;
}> = [
  { value: "system", label: "跟随系统", description: "自动匹配 Windows 明暗模式" },
  { value: "light", label: "明亮", description: "低眩光的浅色工作界面" },
  { value: "dark", label: "深色", description: "适合机房与夜间现场" },
];

const CUSTOM_THEME_PROPERTIES = [
  "--bg", "--bg-elevated", "--sidebar", "--topbar", "--surface", "--surface-2",
  "--surface-3", "--surface-hover", "--surface-active", "--line", "--line-strong",
  "--line-soft", "--text", "--text-strong", "--muted", "--muted-2", "--muted-3",
  "--accent", "--accent-strong", "--on-accent", "--accent-soft", "--accent-border", "--cyan",
  "--cyan-soft", "--success", "--success-soft", "--warning", "--warning-soft",
  "--danger", "--danger-soft", "--info", "--info-soft", "--input-bg",
] as const;

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value);
}

function rgb(color: string): [number, number, number] {
  return [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16)) as [number, number, number];
}

function luminance(color: string): number {
  const values = rgb(color).map((channel) => {
    const normalized = channel / 255;
    return normalized <= .03928 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
  });
  return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (lighter + .05) / (darker + .05);
}

function readableText(preferred: string, background: string): string {
  if (contrast(preferred, background) >= 4.5) return preferred;
  return contrast("#F4F8F5", background) >= contrast("#101A13", background) ? "#F4F8F5" : "#101A13";
}

export function parseCustomTheme(raw: string): CustomTheme {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("主题文件不是有效 JSON。");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("主题根节点必须是对象。");
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== 1) throw new Error("只支持 schemaVersion 1 的主题。");
  if (typeof candidate.name !== "string" || candidate.name.trim().length < 2 || candidate.name.trim().length > 48) {
    throw new Error("主题名称需要 2 到 48 个字符。");
  }
  const colorKeys = [
    "background", "surface", "surfaceElevated", "primary", "secondary", "success",
    "warning", "danger", "textPrimary", "textSecondary", "outline",
  ] as const;
  for (const key of colorKeys) {
    if (!isHexColor(candidate[key])) throw new Error(`${key} 必须是 #RRGGBB 或 #RRGGBBAA 颜色。`);
  }
  const background = String(candidate.background).slice(0, 7);
  const surface = String(candidate.surface).slice(0, 7);
  return {
    schemaVersion: 1,
    name: candidate.name.trim(),
    background: String(candidate.background),
    surface: String(candidate.surface),
    surfaceElevated: String(candidate.surfaceElevated),
    primary: String(candidate.primary),
    secondary: String(candidate.secondary),
    success: String(candidate.success),
    warning: String(candidate.warning),
    danger: String(candidate.danger),
    textPrimary: readableText(String(candidate.textPrimary).slice(0, 7), background),
    textSecondary: readableText(String(candidate.textSecondary).slice(0, 7), surface),
    outline: String(candidate.outline),
  };
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean, customTheme?: CustomTheme | null): ResolvedTheme {
  if (mode === "system") return prefersDark ? "dark" : "light";
  if (mode === "custom") return customTheme && luminance(customTheme.background.slice(0, 7)) < .35 ? "dark" : "light";
  return mode;
}

function loadThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" || stored === "custom"
    ? stored
    : "system";
}

function loadCustomTheme(): CustomTheme | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
  if (!raw) return null;
  try {
    return parseCustomTheme(raw);
  } catch {
    window.localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY);
    return null;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(loadThemeMode);
  const [customTheme, setCustomTheme] = useState<CustomTheme | null>(loadCustomTheme);
  const [prefersDark, setPrefersDark] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : true,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const effectiveMode = mode === "custom" && !customTheme ? "system" : mode;
  const resolvedTheme = resolveTheme(effectiveMode, prefersDark, customTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.themeMode = effectiveMode;
    root.style.colorScheme = resolvedTheme;
    for (const property of CUSTOM_THEME_PROPERTIES) root.style.removeProperty(property);
    if (effectiveMode === "custom" && customTheme) {
      const text = customTheme.textSecondary;
      const properties: Record<(typeof CUSTOM_THEME_PROPERTIES)[number], string> = {
        "--bg": customTheme.background,
        "--bg-elevated": customTheme.surface,
        "--sidebar": customTheme.surface,
        "--topbar": customTheme.background,
        "--surface": customTheme.surface,
        "--surface-2": customTheme.surfaceElevated,
        "--surface-3": customTheme.surfaceElevated,
        "--surface-hover": `color-mix(in srgb, ${customTheme.primary} 10%, ${customTheme.surface})`,
        "--surface-active": `color-mix(in srgb, ${customTheme.primary} 16%, ${customTheme.surface})`,
        "--line": customTheme.outline,
        "--line-strong": `color-mix(in srgb, ${customTheme.outline} 65%, ${customTheme.textPrimary})`,
        "--line-soft": `color-mix(in srgb, ${customTheme.outline} 65%, transparent)`,
        "--text": customTheme.textSecondary,
        "--text-strong": customTheme.textPrimary,
        "--muted": text,
        "--muted-2": text,
        "--muted-3": text,
        "--accent": customTheme.primary,
        "--accent-strong": readableText(customTheme.primary.slice(0, 7), customTheme.surface.slice(0, 7)) === customTheme.primary.slice(0, 7) ? customTheme.primary : customTheme.textPrimary,
        "--on-accent": readableText("#FFFFFF", customTheme.primary.slice(0, 7)),
        "--accent-soft": `color-mix(in srgb, ${customTheme.primary} 13%, transparent)`,
        "--accent-border": `color-mix(in srgb, ${customTheme.primary} 42%, ${customTheme.outline})`,
        "--cyan": customTheme.secondary,
        "--cyan-soft": `color-mix(in srgb, ${customTheme.secondary} 12%, transparent)`,
        "--success": customTheme.success,
        "--success-soft": `color-mix(in srgb, ${customTheme.success} 12%, transparent)`,
        "--warning": customTheme.warning,
        "--warning-soft": `color-mix(in srgb, ${customTheme.warning} 12%, transparent)`,
        "--danger": customTheme.danger,
        "--danger-soft": `color-mix(in srgb, ${customTheme.danger} 12%, transparent)`,
        "--info": customTheme.secondary,
        "--info-soft": `color-mix(in srgb, ${customTheme.secondary} 12%, transparent)`,
        "--input-bg": customTheme.background,
      };
      for (const [property, value] of Object.entries(properties)) root.style.setProperty(property, value);
    }
  }, [customTheme, effectiveMode, resolvedTheme]);

  const setMode = (nextMode: ThemeMode) => {
    if (nextMode === "custom" && !customTheme) return;
    setModeState(nextMode);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
  };

  const importCustomTheme = (raw: string): CustomTheme => {
    const parsed = parseCustomTheme(raw);
    setCustomTheme(parsed);
    setModeState("custom");
    window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(parsed));
    window.localStorage.setItem(THEME_STORAGE_KEY, "custom");
    return parsed;
  };

  const removeCustomTheme = () => {
    setCustomTheme(null);
    setModeState("system");
    window.localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY);
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");
  };

  const value = useMemo(
    () => ({ mode: effectiveMode, resolvedTheme, customTheme, setMode, importCustomTheme, removeCustomTheme }),
    [customTheme, effectiveMode, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme 必须在 ThemeProvider 内使用。");
  return context;
}
