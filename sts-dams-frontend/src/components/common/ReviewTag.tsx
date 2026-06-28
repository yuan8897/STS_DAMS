import React from 'react';

interface Props {
  tags: string[];
  selected?: string[];
  onToggle?: (tag: string) => void;
  readonly?: boolean;
}

const TAG_STYLES: Record<string, string> = {
  '推理烧脑': 'bg-blue-100 text-blue-700 border-blue-200',
  '情感催泪': 'bg-pink-100 text-pink-700 border-pink-200',
  'DM入戏深': 'bg-purple-100 text-purple-700 border-purple-200',
  '氛围感强': 'bg-amber-100 text-amber-700 border-amber-200',
  '欢乐撕逼': 'bg-green-100 text-green-700 border-green-200',
  '机制有趣': 'bg-cyan-100 text-cyan-700 border-cyan-200',
};

function getTagStyle(tag: string): string {
  return TAG_STYLES[tag] || 'bg-gray-100 text-gray-600 border-gray-200';
}

export const ReviewTag: React.FC<Props> = ({ tags, selected = [], onToggle, readonly = false }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const isSelected = selected.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            disabled={readonly}
            className={`px-3 py-1 rounded-full text-sm border transition-all ${
              readonly ? 'cursor-default' : 'cursor-pointer hover:shadow-sm'
            } ${isSelected ? `${getTagStyle(tag)} ring-1 ring-offset-1` : 'bg-gray-50 text-gray-500 border-gray-200'}`}
            onClick={() => onToggle?.(tag)}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
};
