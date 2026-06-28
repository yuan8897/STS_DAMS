import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmDialog open={false} title="Test" message="Msg" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders title and message when open', () => {
    render(
      <ConfirmDialog open title="确认删除" message="此操作不可撤销" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText('确认删除')).toBeInTheDocument();
    expect(screen.getByText('此操作不可撤销')).toBeInTheDocument();
  });

  it('calls onConfirm when clicking confirm button', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog open title="确认删除" message="此操作不可撤销" onConfirm={onConfirm} onCancel={vi.fn()} />
    );
    fireEvent.click(screen.getByText('确认'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when clicking cancel', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="提示" message="确定要取消吗?" onConfirm={vi.fn()} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByText('取消'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel on Escape key', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="退出确认" message="确定要退出吗?" onConfirm={vi.fn()} onCancel={onCancel} />
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('uses custom button text', () => {
    render(
      <ConfirmDialog
        open title="操作确认" message="要继续操作吗?"
        confirmText="是的" cancelText="算了"
        onConfirm={vi.fn()} onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('是的')).toBeInTheDocument();
    expect(screen.getByText('算了')).toBeInTheDocument();
  });

  it('applies danger style when danger prop is true', () => {
    render(
      <ConfirmDialog open title="危险" message="不可逆" danger onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    const confirmBtn = screen.getByText('确认');
    expect(confirmBtn.className).toContain('btn-danger');
  });

  it('has correct ARIA attributes', () => {
    render(
      <ConfirmDialog open title="确认操作" message="请确认" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-dialog-title');
    expect(screen.getByText('确认操作').id).toBe('confirm-dialog-title');
  });
});
