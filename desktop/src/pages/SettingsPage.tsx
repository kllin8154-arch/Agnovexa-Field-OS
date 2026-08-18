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
      <Notice tone="success" title="永久人工执行边界">
        当前桌面端不注册 SSH、Shell、SFTP、进程启动、数据库连接或远程文件写入能力。命令、SQL、配置 Diff、验证和回滚都只能生成、复制并由现场工程师人工执行。
      </Notice>

      <Panel eyebrow="RUNTIME POLICY" title="固化运行边界">
        <div className="policy-grid">
          <div><span>执行模式</span><strong>{policy.executionMode}</strong><Tag>只生成与复制</Tag></div>
          <div><span>网络假设</span><strong>{policy.networkAssumption}</strong><Tag>本地优先</Tag></div>
          <div><span>SSH / Shell</span><strong>{policy.sshCapability}</strong><Tag>永久不注册</Tag></div>
          <div><span>远程写能力</span><strong>{policy.remoteWriteCapability}</strong><Tag>永久关闭</Tag></div>
          <div><span>知识隔离</span><strong>{policy.knowledgeIsolation}</strong><Tag>内部优先</Tag></div>
          <div><span>本地存储</span><strong>{storage.mode}</strong><Tag>{storage.detail}</Tag></div>
        </div>
      </Panel>

      <div className="two-column-grid">
        <Panel eyebrow="AI PROVIDERS" title="多模型接口策略">
          <ul className="check-list">
            <li>支持 DeepSeek、OpenAI、通义千问、Kimi、智谱 GLM、硅基流动、本地服务和自定义 OpenAI 兼容接口。</li>
            <li>只有用户点击“生成草案”或“测试接口”时，才向当前选中的 Provider 发起请求。</li>
            <li>发送前自动脱敏内网 IP、连接凭据、Authorization、Token、API Key 和私钥块。</li>
            <li>Provider 元数据可保存在本机；API Key 只保留在当前运行内存中，关闭程序即清空。</li>
            <li>AI 只能生成计划、命令/SQL 草案、报错分析和知识草稿，不能执行任何操作。</li>
          </ul>
          <a className="secondary-button settings-link" href="#/ai">打开 AI 助手</a>
        </Panel>

        <Panel eyebrow="ERROR LOOP" title="人工报错闭环">
          <ul className="warning-list">
            <li>退出码为 0 时，人工提交证据后才允许进入独立验证。</li>
            <li>退出码非 0 时，不得把任务标记为验证通过。</li>
            <li>可将实际命令/SQL、退出码和 stdout/stderr 一键带入 AI 助手排障。</li>
            <li>AI 返回的新命令仍需重新人工审阅、人工执行并回填新证据。</li>
            <li>只有现场验证成功并完成人工审核，知识条目才能升级为 verified。</li>
          </ul>
        </Panel>
      </div>

      <Panel eyebrow="SECRETS" title="敏感信息策略">
        <div className="policy-grid">
          <div><span>API Key</span><strong>会话内存</strong><Tag>不落 SQLite</Tag></div>
          <div><span>生产密码</span><strong>禁止存储</strong><Tag>不进报告/知识库</Tag></div>
          <div><span>执行证据</span><strong>保存脱敏副本</strong><Tag>保留人工事实</Tag></div>
          <div><span>外部知识</span><strong>draft / reviewed</strong><Tag>人工验证后升级</Tag></div>
        </div>
      </Panel>
    </div>
  );
}
