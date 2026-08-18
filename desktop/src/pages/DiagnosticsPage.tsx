import { useMemo, useState } from "react";
import { CodeBlock, Notice, Panel, Tag } from "../components/Ui";
import { redactSensitiveText } from "../lib/redaction";

const discoverCommands = `echo "===== 基础信息 ====="
hostnamectl || hostname
cat /etc/os-release 2>/dev/null || true
uname -a
arch

echo "===== 资源信息 ====="
lscpu | sed -n '1,25p'
free -h
df -hT
lsblk

echo "===== 网络信息 ====="
ip -br addr
ip route
cat /etc/hosts
cat /etc/resolv.conf
grep -E '^[[:space:]]*hosts:' /etc/nsswitch.conf 2>/dev/null || true

echo "===== 安全与服务 ====="
getenforce 2>/dev/null || true
systemctl --failed 2>/dev/null || true
ss -lntup 2>/dev/null || true

echo "===== 常用运行时 ====="
java -version 2>&1 || true
python3 --version 2>&1 || true
node --version 2>&1 || true
docker --version 2>&1 || true
nginx -v 2>&1 || true`;

export function DiagnosticsPage() {
  const [output, setOutput] = useState("");
  const redacted = useMemo(() => redactSensitiveText(output), [output]);

  return (
    <div className="page-stack">
      <Notice tone="info" title="本页不连接服务器">
        工作台只生成只读采集命令。现场工程师在目标服务器手工执行后，将完整输出粘贴回来形成环境快照。
      </Notice>

      <div className="two-column-grid diagnostics-layout">
        <Panel eyebrow="DISCOVER PACKAGE" title="只读环境采集包">
          <div className="tag-row spaced">
            <Tag>不安装软件</Tag>
            <Tag>不修改文件</Tag>
            <Tag>不重启服务</Tag>
            <Tag>离线可执行</Tag>
          </div>
          <CodeBlock value={discoverCommands} label="DISCOVER-BASELINE-001" />
        </Panel>

        <Panel eyebrow="MANUAL EVIDENCE" title="粘贴现场输出">
          <label className="field-label" htmlFor="diagnostic-output">完整 stdout / stderr</label>
          <textarea
            id="diagnostic-output"
            className="evidence-input large"
            value={output}
            onChange={(event) => setOutput(event.target.value)}
            placeholder="请粘贴完整输出，不要只填写“执行失败”。敏感字段会在保存前提示脱敏。"
          />
          {redacted.total > 0 && (
            <Notice tone="warning" title={`检测到 ${redacted.total} 处敏感信息`}>
              保存快照时只使用脱敏副本；原始粘贴内容不会进入知识库、报告或审计记录。
            </Notice>
          )}
          <div className="evidence-footer">
            <span>{output.length} 字符 · {redacted.total} 处待脱敏</span>
            <button className="primary-button" type="button" disabled={output.trim().length < 20}>
              解析脱敏快照
            </button>
          </div>
        </Panel>
      </div>

      <Panel eyebrow="SNAPSHOT PREVIEW" title="环境快照结构">
        <div className="snapshot-grid">
          {[
            ["操作系统与架构", "Kylin V10 SP3 / x86_64", "confirmed"],
            ["包管理器", "yum / rpm", "confirmed"],
            ["磁盘风险", "/data 剩余空间待回传", "missing"],
            ["网络与 DNS", "DNS 配置已采集，hostname 映射缺失", "warning"],
            ["现有运行时", "Java 8、Nginx、Redis", "confirmed"],
            ["人工确认事项", "服务器型号、变更窗口、验收 URL", "missing"],
          ].map(([label, value, state]) => (
            <div className={`snapshot-item snapshot-item-${state}`} key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
