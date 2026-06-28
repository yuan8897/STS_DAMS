import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorState } from '../ErrorState';

describe('ErrorState', () => {
  it('renders default message', () => {
    render(<ErrorState />);
    expect(screen.getByText('加载出错了，请稍后重试')).toBeInTheDocument();
  });

  it('renders custom message', () => {
    render(<ErrorState message="服务器连接失败" />);
    expect(screen.getByText('服务器连接失败')).toBeInTheDocument();
  });

  it('renders error title', () => {
    render(<ErrorState />);
    expect(screen.getByText('出错了')).toBeInTheDocument();
  });

  it('renders warning icon', () => {
    render(<ErrorState />);
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('renders retry button when onRetry provided', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    const btn = screen.getByText('重试');
    expect(btn).toBeInTheDocument();
  });

  it('calls onRetry when clicking retry button', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByText('重试'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry not provided', () => {
    render(<ErrorState />);
    expect(screen.queryByText('重试')).not.toBeInTheDocument();
  });
});
