import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Loading, PageLoading } from '../Loading';

describe('Loading', () => {
  it('renders default text', () => {
    render(<Loading />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('renders custom text', () => {
    render(<Loading text="正在获取数据..." />);
    expect(screen.getByText('正在获取数据...')).toBeInTheDocument();
  });

  it('renders a spinning element', () => {
    render(<Loading />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});

describe('PageLoading', () => {
  it('renders loading text', () => {
    render(<PageLoading />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('renders full-screen container', () => {
    render(<PageLoading />);
    const container = document.querySelector('.min-h-screen');
    expect(container).toBeInTheDocument();
  });
});
