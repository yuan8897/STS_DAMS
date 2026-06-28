import React, { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open, title, message, confirmText = '确认', cancelText = '取消',
  danger = false, children, onConfirm, onCancel,
}) => {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = 'confirm-dialog-title';

  useEffect(() => {
    if (open) {
      // 保存当前焦点元素
      previousFocusRef.current = document.activeElement as HTMLElement;
      // 自动聚焦确认按钮
      requestAnimationFrame(() => {
        confirmRef.current?.focus();
      });
    } else {
      // 恢复之前聚焦的元素
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/40"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-2xl mx-6 w-full max-w-sm p-6 shadow-xl animate-[scaleIn_0.2s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        <h3 id={titleId} className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
        {children && <div className="mt-3">{children}</div>}
        <div className="mt-6 flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary text-sm">{cancelText}</button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={danger ? 'btn-danger text-sm' : 'btn-primary text-sm'}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
