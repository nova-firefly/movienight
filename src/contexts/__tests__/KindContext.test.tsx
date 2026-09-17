import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KindProvider, useKind } from '../KindContext';

// A tiny consumer that surfaces the context state and lets tests drive it.
const Probe: React.FC = () => {
  const { kind, view, setKind, navigate } = useKind();
  return (
    <div>
      <span data-testid="kind">{kind}</span>
      <span data-testid="view">{view}</span>
      <span data-testid="path">{window.location.pathname}</span>
      <button onClick={() => setKind('show')}>toShows</button>
      <button onClick={() => setKind('movie')}>toMovies</button>
      <button onClick={() => navigate('history')}>goHistory</button>
      <button onClick={() => navigate('this-or-that')}>goTot</button>
    </div>
  );
};

const renderAt = (path: string) => {
  window.history.pushState({}, '', path);
  return render(
    <KindProvider>
      <Probe />
    </KindProvider>,
  );
};

beforeEach(() => {
  localStorage.clear();
});

describe('KindContext', () => {
  it('derives kind and view from the initial path', () => {
    renderAt('/shows/history');
    expect(screen.getByTestId('kind')).toHaveTextContent('show');
    expect(screen.getByTestId('view')).toHaveTextContent('history');
  });

  it('canonicalises an unknown path on mount', () => {
    renderAt('/nonsense');
    expect(screen.getByTestId('kind')).toHaveTextContent('movie');
    expect(screen.getByTestId('view')).toHaveTextContent('queue');
    expect(window.location.pathname).toBe('/movies');
  });

  it('switching kind preserves the current view (D-7)', () => {
    renderAt('/movies/history');
    fireEvent.click(screen.getByText('toShows'));
    expect(screen.getByTestId('kind')).toHaveTextContent('show');
    expect(screen.getByTestId('view')).toHaveTextContent('history');
    expect(window.location.pathname).toBe('/shows/history');
  });

  it('navigate stays within the current kind and updates the URL', () => {
    renderAt('/shows');
    fireEvent.click(screen.getByText('goHistory'));
    expect(screen.getByTestId('view')).toHaveTextContent('history');
    expect(window.location.pathname).toBe('/shows/history');
  });

  it('persists the last-used kind to localStorage', () => {
    renderAt('/movies');
    fireEvent.click(screen.getByText('toShows'));
    expect(localStorage.getItem('contentKind')).toBe('show');
  });

  it('responds to popstate (Back/Forward)', () => {
    renderAt('/movies');
    // Simulate the browser traversing history to another entry.
    act(() => {
      window.history.pushState({}, '', '/shows/history');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByTestId('kind')).toHaveTextContent('show');
    expect(screen.getByTestId('view')).toHaveTextContent('history');
  });
});
