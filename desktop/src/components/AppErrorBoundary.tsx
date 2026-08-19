import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Agnovexa OpsDesk UI error", error, info.componentStack);
  }

  private reload = () => window.location.reload();

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="fatal-screen">
        <section className="fatal-card">
          <div className="fatal-mark">AX</div>
          <p className="eyebrow">APPLICATION RECOVERY</p>
          <h1>界面发生异常，业务数据没有被自动修改</h1>
          <p>
            OpsDesk 没有远程执行能力。本次异常只影响当前界面，可重新加载应用后继续使用。
          </p>
          <pre>{this.state.error.message}</pre>
          <div className="inline-actions">
            <button className="primary-button" type="button" onClick={this.reload}>
              重新加载应用
            </button>
          </div>
        </section>
      </main>
    );
  }
}
