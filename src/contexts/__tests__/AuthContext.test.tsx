import React from 'react';
import { render, act, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Apollo Client
const mockGetMe = jest.fn();
const mockClearStore = jest.fn();

jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  useLazyQuery: () => [mockGetMe],
  useApolloClient: () => ({ clearStore: mockClearStore }),
  gql: (strings: TemplateStringsArray) => strings[0],
}));

import { AuthProvider, useAuth } from '../AuthContext';

// Test component that exposes auth context
function TestConsumer() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="username">{user?.username ?? 'none'}</span>
      <button
        data-testid="login-btn"
        onClick={() =>
          login('tok', {
            id: 1,
            username: 'alice',
            email: 'a@b.com',
            display_name: 'Alice',
            is_admin: false,
            is_active: true,
          } as any)
        }
      >
        Login
      </button>
      <button data-testid="logout-btn" onClick={() => logout()}>
        Logout
      </button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetMe.mockReset();
    mockClearStore.mockReset();
  });

  it('on mount with no token: isAuthenticated is false', async () => {
    mockGetMe.mockResolvedValue({ data: null });
    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>,
      );
    });
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('username').textContent).toBe('none');
  });

  it('on mount with valid token: sets user from getMe', async () => {
    localStorage.setItem('authToken', 'valid-token');
    mockGetMe.mockResolvedValue({
      data: { me: { id: 1, username: 'alice', display_name: 'Alice' } },
    });
    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>,
      );
    });
    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('username').textContent).toBe('alice');
  });

  it('on mount with token but getMe fails: removes token', async () => {
    localStorage.setItem('authToken', 'bad-token');
    mockGetMe.mockRejectedValue(new Error('Unauthorized'));
    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>,
      );
    });
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
  });
});

describe('login', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetMe.mockResolvedValue({ data: null });
    mockClearStore.mockReset();
  });

  it('stores token in localStorage and sets user', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>,
      );
    });
    await act(async () => {
      screen.getByTestId('login-btn').click();
    });
    expect(localStorage.getItem('authToken')).toBe('tok');
    expect(screen.getByTestId('username').textContent).toBe('alice');
    expect(mockClearStore).toHaveBeenCalled();
  });
});

describe('logout', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetMe.mockResolvedValue({ data: null });
    mockClearStore.mockReset();
  });

  it('removes token and clears user', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>,
      );
    });
    // Login first
    await act(async () => {
      screen.getByTestId('login-btn').click();
    });
    expect(screen.getByTestId('authenticated').textContent).toBe('true');

    // Now logout
    await act(async () => {
      screen.getByTestId('logout-btn').click();
    });
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(mockClearStore).toHaveBeenCalledTimes(2); // login + logout
  });
});

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    // Suppress console.error for expected error
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within an AuthProvider');
    consoleSpy.mockRestore();
  });
});
