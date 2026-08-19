import { describe, expect, it } from "vitest";
import { parseCustomTheme, resolveTheme } from "./theme";

const customTheme = {
  schemaVersion: 1 as const,
  name: "现场高对比",
  background: "#101A13",
  surface: "#18231B",
  surfaceElevated: "#223027",
  primary: "#6BBF86",
  secondary: "#63A6A0",
  success: "#6BBF86",
  warning: "#D7AA5D",
  danger: "#DF7C76",
  textPrimary: "#F4F8F5",
  textSecondary: "#CBD8CF",
  outline: "#3B4D41",
};

describe("theme resolution", () => {
  it("honors explicit light and dark modes", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("uses the operating system preference in system mode", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("resolves a custom theme from its background brightness", () => {
    expect(resolveTheme("custom", false, customTheme)).toBe("dark");
    expect(resolveTheme("custom", true, { ...customTheme, background: "#F4F8F5" })).toBe("light");
  });

  it("validates custom theme structure and repairs unreadable text", () => {
    const parsed = parseCustomTheme(JSON.stringify({ ...customTheme, textPrimary: "#101A13" }));
    expect(parsed.name).toBe("现场高对比");
    expect(parsed.textPrimary).toBe("#F4F8F5");
    expect(() => parseCustomTheme('{"schemaVersion":2}')).toThrow("schemaVersion 1");
    expect(() => parseCustomTheme("not-json")).toThrow("有效 JSON");
  });
});
