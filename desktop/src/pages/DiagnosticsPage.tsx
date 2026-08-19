import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CodeBlock, Notice, Panel, Tag } from "../components/Ui";
import { redactSensitiveText } from "../lib/redaction";
import {
  isDesktopRuntime,
  listAssets,
  saveEnvironmentSnapshot,
  type AssetRecord,
} from "../lib/repository";
import { parseEnvironmentSnapshot } from "../lib/snapshot";

const discoverCommands = `echo "===== 基础信息 ====="
hostnamectl || hostname
cat /etc/os-release 2>/dev/null || true
uname -a
arch

echo "===== 资源信息 ====="
lscpu | sed -n '1,25p'
free -h
df -hT
lsblk -f

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
nginx -v 2>&1 || true
psql --version 2>&1 || true`;

export function DiagnosticsPage() {
  const [searchParams] = useSearchParams();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [assetId, setAssetId] = useState(searchParams.get("asset") ?? "");
  const [collector, setCollector] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<{ tone: "success" | "danger" | "warning"; title: string; message: string } | null>(null);
  const redacted = useMemo(() => redactSensitiveText(output), [output]);
  const parsed = useMemo(() => parseEnvironmentSnapshot(redacted.text), [redacted.text]);

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    void listAssets()
      .then((nextAssets) => {
        setAssets(nextAssets);
        setAssetId((current) => current || nextAssets[0]?.id || "");
      })
      .catch((error) => setStatus({ tone: "danger", title: "资产读取失败", message: error instanceof Error ? error.message : String(error) }));
  }, []);

  const saveSnapshot = async () => {
    try {
      await saveEnvironmentSnapshot({
        assetId,
        collectedBy: collector,
        rawOutputRedacted: redacted.text,
        parsed,
      });
      setStatus({ tone: "success", title: "环境快照已保存", message: "脱敏原始输出和结构化事实已写入本地 SQLite。原始敏感文本未入库。" });
    } catch (error) {
      setStatus({ tone: "danger", title: "快照保存失败", message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <div className="page-stack diagnostics-page">
      <Notice tone="info" title="本页不连接服务器">
        工作台只生成只读采集命令。现场工程师在目标服务器手工执行后，将完整输出粘贴回来；保存前自动脱敏并保留结构化事实。
      </Notice>
      {status && <Notice tone={status.tone} title={status.title}>{status.message}</Notice>}

      <div className="diagnostic-target-bar">
        <label><span>目标资产</span><select className="select-input" value={assetId} onChange={(event) => setAssetId(event.target.value)} disabled={!isDesktopRuntime()}><option value="">请选择资产</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.projectName} / {asset.name}</option>)}</select></label>
        <label><span>采集人员</span><input className="text-input" value={collector} onChange={(event) => setCollector(event.target.value)} placeholder="用于审计，可留空" /></label>
        <div className="diagnostic-target-state"><span>存储方式</span><strong>{isDesktopRuntime() ? "本地 SQLite" : "浏览器预览"}</strong></div>
      </div>

      <div className="two-column-grid diagnostics-layout">
        <Panel eyebrow="DISCOVER PACKAGE" title="只读环境采集包">
          <div className="tag-row spaced"><Tag>不安装软件</Tag><Tag>不修改文件</Tag><Tag>不重启服务</Tag><Tag>离线可执行</Tag></div>
          <CodeBlock value={discoverCommands} label="DISCOVER-BASELINE-001" />
        </Panel>

        <Panel eyebrow="MANUAL EVIDENCE" title="粘贴现场输出">
          <label className="field-label" htmlFor="diagnostic-output">完整 stdout / stderr</label>
          <textarea id="diagnostic-output" className="evidence-input large" value={output} onChange={(event) => { setOutput(event.target.value); setStatus(null); }} placeholder="请粘贴完整输出，不要只填写“执行失败”。敏感字段只在当前页面中临时存在。" />
          {redacted.total > 0 && <Notice tone="warning" title={`检测到 ${redacted.total} 处敏感信息`}>入库和发送给 AI 时只使用脱敏副本；生产 IP、密码、Token、连接凭据和私钥块不会进入知识库或报告。</Notice>}
          <div className="evidence-footer"><span>{output.length} 字符 · {redacted.total} 处已脱敏</span><button className="primary-button" type="button" disabled={!isDesktopRuntime() || !assetId || output.trim().length < 20} onClick={() => void saveSnapshot()}>保存版本化快照</button></div>
        </Panel>
      </div>

      <Panel eyebrow="PARSED SNAPSHOT" title="结构化环境事实" actions={<span className={`badge snapshot-${parsed.status === "complete" ? "完整" : parsed.status === "conflict" ? "冲突" : "缺失"}`}>{parsed.status === "complete" ? "完整" : parsed.status === "conflict" ? "存在冲突" : "信息缺失"}</span>}>
        {output.trim().length < 20 ? (
          <div className="empty-state compact"><div className="empty-state-mark">SN</div><h2>等待现场采集输出</h2><p>粘贴执行结果后，系统会提取稳定事实、缺失项和冲突项。</p></div>
        ) : (
          <>
            <div className="snapshot-grid production-snapshot-grid">
              {Object.entries(parsed.facts).map(([label, value]) => <div className="snapshot-item snapshot-item-confirmed" key={label}><span>{label}</span><strong>{value}</strong></div>)}
            </div>
            <div className="two-column-grid snapshot-review-grid">
              <div className="snapshot-review-card"><strong>缺失信息</strong>{parsed.missingFacts.length ? <ul>{parsed.missingFacts.map((item) => <li key={item}>{item}</li>)}</ul> : <p>没有检测到关键缺失项。</p>}</div>
              <div className="snapshot-review-card warning"><strong>冲突与人工确认</strong>{parsed.conflictingFacts.length ? <ul>{parsed.conflictingFacts.map((item) => <li key={item}>{item}</li>)}</ul> : <p>没有检测到明显冲突。</p>}</div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
