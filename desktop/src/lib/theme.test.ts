import { describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";

describe("theme resolution", () => {
  it("honors explicit light and dark modes", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("uses the operating system preference in system mode", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});
