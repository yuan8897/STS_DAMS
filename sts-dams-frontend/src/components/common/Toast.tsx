import React, { useEffect, useState, useRef } from 'react';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning';
}

let addToastFn: ((msg: string, type: ToastItem['type']) => void) | null = null;

export function showToast(message: string, type: ToastItem['type'] = 'success') {
  addToastFn?.(message, type);
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    addToastFn = (message: string, type: ToastItem['type']) => {
      const id = ++counter.current;
      setToasts(prev => [...prev.slice(-2), { id, message, type }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
    };
    return () => { addToastFn = null; };
  }, []);

  if (toasts.length === 0) return null;

  const colorMap = {
    success: 'bg-green-600',
    error: 'bg-red-500',
    warning: 'bg-orange-500',
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[90%] max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`${colorMap[t.type]} text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-[slideDown_0.3s_ease-out] text-center`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
};
