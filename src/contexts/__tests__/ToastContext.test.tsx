import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToastProvider, useToast } from '../ToastContext';

// Minimal MUI Joy mock — Snackbar renders children when open
jest.mock('@mui/joy', () => {
  const actual = jest.requireActual('@mui/joy');
  return {
    ...actual,
    Snackbar: ({ open, children, color }: any) =>
      open ? (
        <div data-testid="snackbar" data-color={color}>
          {children}
        </div>
      ) : null,
  };
});

function TestConsumer() {
  const { showSuccess, showError, showToast } = useToast();
  return (
    <div>
      <button data-testid="success-btn" onClick={() => showSuccess('Done!')}>
        Success
      </button>
      <button data-testid="error-btn" onClick={() => showError('Oops!')}>
        Error
      </button>
      <button data-testid="toast-btn" onClick={() => showToast('Info', 'warning', 3000)}>
        Toast
      </button>
    </div>
  );
}

describe('ToastProvider', () => {
  it('showSuccess renders a success snackbar', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );
    act(() => {
      screen.getByTestId('success-btn').click();
    });
    const snackbar = screen.getByTestId('snackbar');
    expect(snackbar).toHaveAttribute('data-color', 'success');
    expect(snackbar).toHaveTextContent('Done!');
  });

  it('showError renders a danger snackbar', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );
    act(() => {
      screen.getByTestId('error-btn').click();
    });
    const snackbar = screen.getByTestId('snackbar');
    expect(snackbar).toHaveAttribute('data-color', 'danger');
    expect(snackbar).toHaveTextContent('Oops!');
  });

  it('showToast renders with custom color', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );
    act(() => {
      screen.getByTestId('toast-btn').click();
    });
    const snackbar = screen.getByTestId('snackbar');
    expect(snackbar).toHaveAttribute('data-color', 'warning');
    expect(snackbar).toHaveTextContent('Info');
  });
});

describe('useToast', () => {
  it('throws when used outside ToastProvider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    expect(() => render(<TestConsumer />)).toThrow('useToast must be used within a ToastProvider');
    consoleSpy.mockRestore();
  });
});
