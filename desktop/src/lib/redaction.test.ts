import { describe, expect, it } from "vitest";
import { redactSensitiveText } from "./redaction";

describe("redactSensitiveText", () => {
  it("masks credentials, provider tokens and private addresses", () => {
    const result = redactSensitiveText(
      "postgresql://admin:secret@10.12.3.18/gis password=hunter2 sk-test_12345678901234567890",
    );

    expect(result.text).not.toContain("secret");
    expect(result.text).not.toContain("hunter2");
    expect(result.text).not.toContain("10.12.3.18");
    expect(result.text).not.toContain("sk-test_12345678901234567890");
    expect(result.total).toBeGreaterThanOrEqual(4);
  });

  it("removes complete private-key blocks", () => {
    const result = redactSensitiveText(
      "-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----",
    );
    expect(result.text).toBe("<PRIVATE_KEY_REDACTED>");
  });
});
