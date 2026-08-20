import { describe, expect, it } from "vitest";
import { buildDeploymentExecutionDraft } from "./deploymentDraft";

const asset = {
  name: "GIS 服务",
  host: "10.20.30.40",
  operatingSystem: "银河麒麟 V10 SP3",
  architecture: "aarch64" as const,
};

describe("deployment template draft", () => {
  it("生成可审阅的 GeoServer 前置检查并保留缺失事实", () => {
    const draft = buildDeploymentExecutionDraft({
      templateId: "template-geoserver",
      asset,
      requiredInputs: ["schema", "table", "SRID"],
    });
    expect(draft.commands).toContain("PostGIS_Full_Version");
    expect(draft.commands).toContain("只做发布前检查");
    expect(draft.missingFacts).toEqual(["schema", "table", "SRID"]);
  });

  it("JDK 已提供介质和目录时不再报告这两项缺失", () => {
    const draft = buildDeploymentExecutionDraft({
      templateId: "template-jdk",
      asset,
      offlineMedia: "/media/jdk.tar.gz",
      targetDirectories: "/opt/jdk-17",
    });
    expect(draft.commands).toContain("/media/jdk.tar.gz");
    expect(draft.missingFacts).toEqual([]);
  });
});
