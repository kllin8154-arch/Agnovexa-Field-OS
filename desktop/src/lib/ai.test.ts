import { describe, expect, it } from "vitest";
import {
  DEFAULT_AI_SYSTEM_PROMPT,
  DEFAULT_PROVIDER_PROFILES,
  normalizeChatEndpoint,
  prepareOpsPrompt,
} from "./ai";

describe("AI provider gateway", () => {
  it("normalizes OpenAI-compatible base URLs", () => {
    expect(normalizeChatEndpoint("https://api.example.com/v1/"))
      .toBe("https://api.example.com/v1/chat/completions");
    expect(normalizeChatEndpoint("https://api.example.com/v1/chat/completions"))
      .toBe("https://api.example.com/v1/chat/completions");
  });

  it("redacts execution evidence before it becomes an AI prompt", () => {
    const prepared = prepareOpsPrompt({
      mode: "diagnose-error",
      task: "排查数据库连接失败",
      projectContext: "项目：国产化服务平台\n服务器：数据库节点 / 银河麒麟 V10 SP3 / aarch64",
      environment: "目标地址 192.168.10.206",
      commandOrSql: "psql postgresql://admin:secret@192.168.10.206/gis",
      executionOutput: "Authorization: Bearer sk-test_12345678901234567890",
    });

    expect(prepared.redactionCount).toBeGreaterThanOrEqual(3);
    expect(prepared.prompt).not.toContain("192.168.10.206");
    expect(prepared.prompt).not.toContain("secret@192");
    expect(prepared.prompt).not.toContain("sk-test_12345678901234567890");
    expect(prepared.prompt).toContain("已选择项目上下文");
  });

  it("keeps provider templates free of persisted secrets", () => {
    for (const profile of DEFAULT_PROVIDER_PROFILES) {
      expect(Object.prototype.hasOwnProperty.call(profile, "apiKey")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(profile, "token")).toBe(false);
    }
    expect(DEFAULT_PROVIDER_PROFILES.map((profile) => profile.kind)).toEqual(
      expect.arrayContaining(["deepseek", "openai", "qwen", "kimi", "zhipu", "siliconflow", "local", "custom"]),
    );
  });

  it("hard-codes the human-only execution boundary in the system prompt", () => {
    expect(DEFAULT_AI_SYSTEM_PROMPT).toContain("不能执行命令、SQL");
    expect(DEFAULT_AI_SYSTEM_PROMPT).toContain("只能交给人工执行");
    expect(DEFAULT_AI_SYSTEM_PROMPT).toContain("不得声称");
  });
});
