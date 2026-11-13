import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EpisodeProgressControl } from '../kindAffordance';

describe('EpisodeProgressControl', () => {
  it('offers "Track progress" when nothing is tracked yet', () => {
    const onEdit = jest.fn();
    render(<EpisodeProgressControl title="Severance" value={null} onEdit={onEdit} />);
    const button = screen.getByRole('button', { name: 'Track progress for Severance' });
    expect(button).toHaveTextContent('Track progress');
    fireEvent.click(button);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('makes the current position the button once progress is set', () => {
    const onEdit = jest.fn();
    render(<EpisodeProgressControl title="Severance" value="S2 E4" onEdit={onEdit} />);
    const button = screen.getByRole('button', { name: 'Update progress for Severance, now S2 E4' });
    expect(button).toHaveTextContent('S2 E4');
    fireEvent.click(button);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('is a read-only chip without an edit handler', () => {
    render(<EpisodeProgressControl title="Severance" value="S2 E4" />);
    expect(screen.getByText('S2 E4')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing read-only when there is no progress', () => {
    const { container } = render(<EpisodeProgressControl title="Severance" value={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
