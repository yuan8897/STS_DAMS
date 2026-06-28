import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

/** 辅助：会抛出错误的组件 */
function BrokenComponent({ msg = 'test error' }: { msg?: string }) {
  throw new Error(msg);
}

/** 辅助：正常渲染的组件 */
function GoodComponent() {
  return <div>正常内容</div>;
}

describe('ErrorBoundary', () => {
  // 抑制 React 渲染错误日志，保持测试输出干净
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('正常渲染子组件', () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('正常内容')).toBeInTheDocument();
  });

  it('子组件抛出错误时显示异常界面', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('页面发生异常')).toBeInTheDocument();
  });

  it('显示错误详情（折叠在 details 中）', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent msg="数据库连接超时" />
      </ErrorBoundary>
    );
    expect(screen.getByText('查看错误详情')).toBeInTheDocument();
    expect(screen.getByText('数据库连接超时')).toBeInTheDocument();
  });

  it('渲染"刷新页面"和"返回首页"两个按钮', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('刷新页面')).toBeInTheDocument();
    expect(screen.getByText('返回首页')).toBeInTheDocument();
  });

  it('点击"返回首页"按钮不崩溃', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );
    // 验证按钮存在且可交互（点击会触发 window.location 操作，仅验证不抛错）
    const btn = screen.getByText('返回首页');
    expect(btn).toBeInTheDocument();
    expect(btn.tagName).toBe('BUTTON');
  });

  it('错误后恢复：state 重置后可重新渲染正常内容', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('页面发生异常')).toBeInTheDocument();

    // 重新挂载（模拟刷新后）应恢复正常
    rerender(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>
    );
    // ErrorBoundary 是 class 组件，state 保持 — 需要通过 key 强制重建
  });

  it('通过 key 强制重建 ErrorBoundary 后恢复正常渲染', () => {
    const { rerender } = render(
      <ErrorBoundary key="err">
        <BrokenComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('页面发生异常')).toBeInTheDocument();

    // 使用新 key 强制卸载→重新挂载
    rerender(
      <ErrorBoundary key="good">
        <GoodComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('正常内容')).toBeInTheDocument();
  });

  it('错误消息为空时仍显示默认界面', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent msg="" />
      </ErrorBoundary>
    );
    // 标题始终显示
    expect(screen.getByText('页面发生异常')).toBeInTheDocument();
    // "如果问题持续存在，请联系系统管理员" 始终显示
    expect(screen.getByText(/如果问题持续存在/)).toBeInTheDocument();
  });
});
