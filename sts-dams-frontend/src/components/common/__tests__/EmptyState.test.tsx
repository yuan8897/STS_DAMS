import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="暂无数据" />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  it('renders default icon when not provided', () => {
    render(<EmptyState title="暂无" />);
    expect(screen.getByText('📭')).toBeInTheDocument();
  });

  it('renders custom icon', () => {
    render(<EmptyState title="空" icon="📦" />);
    expect(screen.getByText('📦')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="暂无" description="请稍后再来" />);
    expect(screen.getByText('请稍后再来')).toBeInTheDocument();
  });

  it('does not render description paragraph when not provided', () => {
    const { container } = render(<EmptyState title="暂无" />);
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(0);
  });
});
