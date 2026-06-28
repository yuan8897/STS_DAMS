import React from 'react';
import { LEVEL_NAMES, LEVEL_COLORS } from '../../constants/maps';

interface Props {
  level: string;
  points: number;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASS = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-2 text-base',
};

const ICONS: Record<string, string> = {
  Bronze: '🥉', Silver: '🥈', Gold: '🥇',
  Platinum: '💎', Diamond: '💎',
};

export const PointsBadge: React.FC<Props> = ({ level, points, size = 'md' }) => {
  const color = LEVEL_COLORS[level] || '#888';
  const label = LEVEL_NAMES[level] || level;
  const icon = ICONS[level] || '⭐';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${SIZE_CLASS[size]}`}
      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}44` }}>
      <span>{icon}</span>
      <span>{label}</span>
      <span className="opacity-70 ml-0.5">{points.toLocaleString()} 分</span>
    </span>
  );
};
