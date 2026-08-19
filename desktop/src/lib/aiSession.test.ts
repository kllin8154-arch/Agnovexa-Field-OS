import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllSessionApiKeys,
  clearSessionApiKey,
  getSessionApiKey,
  hasSessionApiKey,
  setSessionApiKey,
} from "./aiSession";

describe("AI session key vault", () => {
  beforeEach(() => clearAllSessionApiKeys());

  it("keeps keys in memory and returns them by provider", () => {
    setSessionApiKey("deepseek", "  sk-session-only  ");
    expect(getSessionApiKey("deepseek")).toBe("sk-session-only");
    expect(hasSessionApiKey("deepseek")).toBe(true);
  });

  it("clears one provider without affecting another", () => {
    setSessionApiKey("deepseek", "one");
    setSessionApiKey("openai", "two");
    clearSessionApiKey("deepseek");
    expect(getSessionApiKey("deepseek")).toBe("");
    expect(getSessionApiKey("openai")).toBe("two");
  });

  it("treats blank values as removal", () => {
    setSessionApiKey("custom", "secret");
    setSessionApiKey("custom", "   ");
    expect(hasSessionApiKey("custom")).toBe(false);
  });
});
