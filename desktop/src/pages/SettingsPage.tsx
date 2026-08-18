import { useEffect, useState } from "react";
import { probeStorage, type StorageProbe } from "../lib/database";
import { DEFAULT_RUNTIME_POLICY, loadRuntimePolicy } from "../lib/runtimePolicy";
import type { RuntimePolicy } from "../types";
import { Notice, Panel, Tag } from "../components/Ui";

export function SettingsPage() {
  const [policy, setPolicy] = useState<RuntimePolicy>(DEFAULT_RUNTIME_POLICY);
  const [storage, setStorage] = useState<StorageProbe>({
    mode: "browser-preview",
    detail: "正在检测…",
  });

  useEffect(() => {
    void loadRuntimePolicy().then(setPolicy);
    void probeStorage().then(setStorage);
  }, []);

  return (
    <div className="page-stack">
      <Notice tone="success" title="最小权限基线">
        当前桌面壳只开放本地 SQLite 与只读运行策略查询；未注册 Shell、SSH、SFTP、文件系统全盘访问或远程写入能力。
      </Notice>

      <Panel eyebrow="RUNTIME POLICY" title="固化运行边界">
        <div className="policy-grid">
          <div><span>执行模式</span><strong>{policy.executionMode}</strong><Tag>人工复制执行</Tag></div>
          <div><span>网络假设</span><strong>{policy.networkAssumption}</strong><Tag>完全离线优先</Tag></div>
          <div><span>SSH 能力</span><strong>{policy.sshCapability}</strong><Tag>未注册</Tag></div>
          <div><span>远程写能力</span><strong>{policy.remoteWriteCapability}</strong><Tag>未注册</Tag></div>
          <div><span>知识隔离</span><strong>{policy.knowledgeIsolation}</strong><Tag>内部优先</Tag></div>
          <div><span>本地存储</span><strong>{storage.mode}</strong><Tag>{storage.detail}</Tag></div>
        </div>
      </Panel>

      <div className="two-column-grid">
        <Panel eyebrow="MODEL / HARNESS" title="DeepSeek Harness 接入边界">
          <ul className="check-list">
            <li>只允许生成计划、命令草案、诊断归纳和知识条目。</li>
            <li>不得注册生产命令执行工具。</li>
            <li>缺失公司专有软件 SOP 时停止推断。</li>
            <li>外部检索前先脱敏，结果始终标记为 draft。</li>
          </ul>
          <button className="secondary-button" type="button">配置本地 Harness（后续）</button>
        </Panel>

        <Panel eyebrow="CREDENTIALS" title="凭据策略">
          <ul className="warning-list">
            <li>SQLite 只保存 credential_reference_id，不保存明文口令。</li>
            <li>生产密码、Token、私钥不进入知识库、Git、报告或执行证据。</li>
            <li>凭据能力尚未启用；后续接入系统 Credential Manager / Keychain。</li>
          </ul>
          <button className="secondary-button" type="button" disabled>凭据库尚未启用</button>
        </Panel>
      </div>
    </div>
  );
}
