import React from 'react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = '加载出错了，请稍后重试',
  onRetry,
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <span className="text-5xl mb-4">⚠️</span>
    <h3 className="text-gray-500 font-medium text-base">出错了</h3>
    <p className="text-gray-400 text-sm mt-1 text-center">{message}</p>
    {onRetry && (
      <button onClick={onRetry} className="btn-primary mt-4 text-sm">
        重试
      </button>
    )}
  </div>
);
