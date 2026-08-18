import { deploymentTemplates } from "../data/mock";
import { Notice, Panel, RiskBadge, StatusBadge, Tag } from "../components/Ui";

export function DeploymentPage() {
  return (
    <div className="page-stack">
      <Notice tone="warning" title="离线环境假设已固化">
        模板不会默认生成 yum、apt、pip、npm、mvn、Docker Hub 或 GitHub 下载命令；缺少安装介质时只列出人工准备项。
      </Notice>

      <Panel eyebrow="OFFLINE TEMPLATE CATALOG" title="部署与配置模板">
        <div className="template-grid">
          {deploymentTemplates.map((template) => (
            <article className="template-card" key={template.id}>
              <div className="template-top">
                <span className="template-category">{template.category}</span>
                <RiskBadge level={template.risk} />
              </div>
              <h3>{template.name}</h3>
              <p>{template.description}</p>
              <div className="tag-row">
                <StatusBadge status={template.verifiedStatus} />
                {template.offlineReady && <Tag>完全离线</Tag>}
              </div>
              <div className="required-inputs">
                <span>必须输入</span>
                <ul>
                  {template.requiredInputs.map((input) => <li key={input}>{input}</li>)}
                </ul>
              </div>
              <button className="secondary-button wide" type="button">从模板创建任务</button>
            </article>
          ))}
        </div>
      </Panel>

      <Panel eyebrow="DEPLOYMENT DEFINITION" title="任务定义示例">
        <div className="definition-board">
          <div>
            <span>项目</span>
            <strong>湖南数字地质</strong>
          </div>
          <div>
            <span>部署模式</span>
            <strong>离线升级</strong>
          </div>
          <div>
            <span>目标资产</span>
            <strong>地图发布节点</strong>
          </div>
          <div>
            <span>允许中断</span>
            <strong>待人工确认</strong>
          </div>
          <div>
            <span>安装介质</span>
            <strong>GeoServer 离线包 / JDK 17</strong>
          </div>
          <div>
            <span>验收标准</span>
            <strong>服务、端口、WMS、业务地图四层验证</strong>
          </div>
        </div>
      </Panel>
    </div>
  );
}
