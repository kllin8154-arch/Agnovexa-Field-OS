import { describe, expect, it } from "vitest";
import { OPSDESK_PRODUCTION_AI_PROMPT } from "./aiPolicy";

describe("production AI policy", () => {
  it("keeps execution and knowledge-source boundaries in the system prompt", () => {
    expect(OPSDESK_PRODUCTION_AI_PROMPT).toContain("不能执行命令、SQL");
    expect(OPSDESK_PRODUCTION_AI_PROMPT).toContain("[已验证 Skill]");
    expect(OPSDESK_PRODUCTION_AI_PROMPT).toContain("待人工执行");
  });
});
