import { Component, type ErrorInfo, type ReactNode } from "react";
import { BrandMark } from "./BrandMark";

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Agnovexa OpsDesk render failure", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-screen">
        <div className="fatal-card">
          <div className="brand-symbol" aria-hidden="true"><BrandMark className="brand-mark" /></div>
          <span className="eyebrow">APPLICATION ERROR</span>
          <h1>页面加载失败</h1>
          <p>本地数据没有被删除。请重新加载应用；若问题持续出现，请保留下方错误摘要。</p>
          <pre>{this.state.error.message}</pre>
          <button className="primary-button" type="button" onClick={() => window.location.reload()}>重新加载</button>
        </div>
      </main>
    );
  }
}
