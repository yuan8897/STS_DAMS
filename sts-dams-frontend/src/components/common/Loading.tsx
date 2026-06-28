import React from 'react';

interface LoadingProps {
  text?: string;
}

export const Loading: React.FC<LoadingProps> = ({ text = '加载中...' }) => (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="w-10 h-10 border-4 border-gray-200 border-t-accent-purple rounded-full animate-spin" />
    <p className="mt-4 text-gray-400 text-sm">{text}</p>
  </div>
);

export const PageLoading: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-base-light">
    <div className="flex flex-col items-center">
      <div className="w-12 h-12 border-4 border-gray-200 border-t-accent-purple rounded-full animate-spin" />
      <p className="mt-4 text-gray-400 text-sm">加载中...</p>
    </div>
  </div>
);
