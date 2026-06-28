import React, { useState } from 'react';

interface Props {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const SIZE_MAP = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' };

export const StarRating: React.FC<Props> = ({ value, onChange, readonly = false, size = 'md', label }) => {
  const [hover, setHover] = useState(0);

  const displayValue = hover || value;

  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label || '评分'}>
      {label && <span className="text-sm text-gray-500 mr-2 w-12">{label}</span>}
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={star <= displayValue}
          aria-label={`${star}星`}
          disabled={readonly}
          className={`${SIZE_MAP[size]} transition-colors ${
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
          } ${star <= displayValue ? 'text-yellow-400' : 'text-gray-300'}`}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
        >
          {star <= displayValue ? '★' : '☆'}
        </button>
      ))}
      {!readonly && (
        <span className="ml-2 text-sm text-gray-400">
          {displayValue > 0 ? `${displayValue} 分` : '未评分'}
        </span>
      )}
    </div>
  );
};
