import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StarRating } from '../StarRating';

describe('StarRating', () => {
  it('renders 5 star buttons', () => {
    render(<StarRating value={3} />);
    const stars = screen.getAllByRole('radio');
    expect(stars).toHaveLength(5);
  });

  it('highlights filled stars based on value', () => {
    render(<StarRating value={4} />);
    const stars = screen.getAllByRole('radio');
    // First 4 stars should be checked (filled)
    for (let i = 0; i < 4; i++) {
      expect(stars[i]).toHaveAttribute('aria-checked', 'true');
    }
    // 5th star should be unchecked
    expect(stars[4]).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange when clicking a star', () => {
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} />);
    const stars = screen.getAllByRole('radio');
    fireEvent.click(stars[2]); // Click 3rd star
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('does not call onChange in readonly mode', () => {
    const onChange = vi.fn();
    render(<StarRating value={3} onChange={onChange} readonly />);
    const stars = screen.getAllByRole('radio');
    fireEvent.click(stars[4]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables buttons in readonly mode', () => {
    render(<StarRating value={3} readonly />);
    const stars = screen.getAllByRole('radio');
    stars.forEach(star => expect(star).toBeDisabled());
  });

  it('renders label when provided', () => {
    render(<StarRating value={3} label="DM评分" />);
    expect(screen.getByText('DM评分')).toBeInTheDocument();
  });

  it('shows score text when not readonly', () => {
    render(<StarRating value={4} />);
    expect(screen.getByText('4 分')).toBeInTheDocument();
  });

  it('shows "未评分" when value is 0', () => {
    render(<StarRating value={0} />);
    expect(screen.getByText('未评分')).toBeInTheDocument();
  });
});
