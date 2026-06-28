import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon = '📭', title, description }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <span className="text-5xl mb-4">{icon}</span>
    <h3 className="text-gray-500 font-medium text-base">{title}</h3>
    {description && <p className="text-gray-400 text-sm mt-1">{description}</p>}
  </div>
);
