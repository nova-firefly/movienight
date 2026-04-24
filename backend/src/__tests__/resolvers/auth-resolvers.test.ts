import {
  mockQuery,
  mockHashPassword,
  mockComparePassword,
  mockGenerateToken,
  mockGenerateResetToken,
  mockHashResetToken,
  mockSendPasswordResetEmail,
  authContext,
  adminContext,
  anonContext,
} from './__helpers';
import { resolvers } from '../../resolvers';

const { login, createUser, updateUser, deleteUser, requestPasswordReset, resetPassword } =
  resolvers.Mutation;

describe('Mutation.login', () => {
  const ctx = { user: null, ipAddress: '10.0.0.1', userAgent: 'Mozilla/5.0' };

  it('returns token and user on successful login', async () => {
    const dbUser = {
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      display_name: 'Alice',
      password_hash: 'hashed',
      is_admin: false,
      is_active: true,
      last_login_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockQuery
      .mockResolvedValueOnce({ rows: [dbUser] }) // SELECT user
      .mockResolvedValueOnce({ rows: [] }) // UPDATE last_login_at
      .mockResolvedValueOnce({ rows: [] }) // logLoginHistory
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    mockComparePassword.mockResolvedValue(true);
    mockGenerateToken.mockReturnValue('jwt-token');

    const result = await login(null, { username: 'alice', password: 'pass' }, ctx);
    expect(result.token).toBe('jwt-token');
    expect(result.user.username).toBe('alice');
    expect(result.user).not.toHaveProperty('password_hash');
  });

  it('throws UNAUTHENTICATED for invalid username', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // no user found
      .mockResolvedValueOnce({ rows: [] }); // logLoginHistory
    await expect(login(null, { username: 'nobody', password: 'pass' }, ctx)).rejects.toThrow(
      'Invalid credentials',
    );
  });

  it('throws UNAUTHENTICATED for wrong password', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, username: 'alice', password_hash: 'h' }] })
      .mockResolvedValueOnce({ rows: [] }); // logLoginHistory
    mockComparePassword.mockResolvedValue(false);
    await expect(login(null, { username: 'alice', password: 'wrong' }, ctx)).rejects.toThrow(
      'Invalid credentials',
    );
  });

  it('throws FORBIDDEN for disabled account', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 1, username: 'alice', password_hash: 'h', is_active: false }],
      })
      .mockResolvedValueOnce({ rows: [] }); // logLoginHistory
    mockComparePassword.mockResolvedValue(true);
    await expect(login(null, { username: 'alice', password: 'pass' }, ctx)).rejects.toThrow(
      'Account is disabled',
    );
  });

  it('throws TOO_MANY_REQUESTS after exceeding login rate limit', async () => {
    const rateLimitCtx = { user: null, ipAddress: '10.99.99.99', userAgent: 'Mozilla/5.0' };
    // Exhaust 10 login attempts (LOGIN_RATE_LIMIT_MAX = 10)
    for (let i = 0; i < 10; i++) {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // no user found
        .mockResolvedValueOnce({ rows: [] }); // logLoginHistory
      try {
        await login(null, { username: `user${i}`, password: 'pass' }, rateLimitCtx);
      } catch {
        // Expected: "Invalid credentials"
      }
    }
    // 11th attempt should be rate limited
    await expect(
      login(null, { username: 'user11', password: 'pass' }, rateLimitCtx),
    ).rejects.toThrow('Too many login attempts');
  });
});

describe('Mutation.createUser', () => {
  it('admin can create user', async () => {
    mockHashPassword.mockResolvedValue('hashed-pw');
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 2, username: 'newuser', email: 'new@test.com', is_admin: false }],
      })
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await createUser(
      null,
      { username: 'newuser', email: 'new@test.com', password: 'pass123' } as any,
      adminContext(),
    );
    expect(result.username).toBe('newuser');
    expect(mockHashPassword).toHaveBeenCalledWith('pass123');
  });

  it('non-admin gets FORBIDDEN', async () => {
    await expect(
      createUser(null, { username: 'u', email: 'e@e.com', password: 'p' } as any, authContext()),
    ).rejects.toThrow('Not authorized');
  });

  it('unauthenticated gets FORBIDDEN', async () => {
    await expect(
      createUser(null, { username: 'u', email: 'e@e.com', password: 'p' } as any, anonContext()),
    ).rejects.toThrow('Not authorized');
  });

  it('rejects empty username', async () => {
    await expect(
      createUser(
        null,
        { username: '', email: 'e@e.com', password: 'pass123' } as any,
        adminContext(),
      ),
    ).rejects.toThrow('Username must be between 1 and 100 characters');
  });

  it('rejects username exceeding 100 characters', async () => {
    await expect(
      createUser(
        null,
        { username: 'A'.repeat(101), email: 'e@e.com', password: 'pass123' } as any,
        adminContext(),
      ),
    ).rejects.toThrow('Username must be between 1 and 100 characters');
  });

  it('rejects empty email', async () => {
    await expect(
      createUser(null, { username: 'user', email: '', password: 'pass123' } as any, adminContext()),
    ).rejects.toThrow('Email must be between 1 and 255 characters');
  });

  it('rejects email exceeding 255 characters', async () => {
    await expect(
      createUser(
        null,
        { username: 'user', email: 'a'.repeat(256), password: 'pass123' } as any,
        adminContext(),
      ),
    ).rejects.toThrow('Email must be between 1 and 255 characters');
  });

  it('rejects password shorter than 6 characters', async () => {
    await expect(
      createUser(
        null,
        { username: 'user', email: 'e@e.com', password: '12345' } as any,
        adminContext(),
      ),
    ).rejects.toThrow('Password must be between 6 and 128 characters');
  });

  it('rejects password exceeding 128 characters', async () => {
    await expect(
      createUser(
        null,
        { username: 'user', email: 'e@e.com', password: 'A'.repeat(129) } as any,
        adminContext(),
      ),
    ).rejects.toThrow('Password must be between 6 and 128 characters');
  });
});

describe('Mutation.updateUser', () => {
  it('admin can update user fields', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 2, username: 'updated', email: 'u@t.com' }],
      })
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await updateUser(null, { id: '2', username: 'updated' } as any, adminContext());
    expect(result.username).toBe('updated');
  });

  it('hashes password when provided', async () => {
    mockHashPassword.mockResolvedValue('new-hash');
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 2 }] }).mockResolvedValueOnce({ rows: [] });
    await updateUser(null, { id: '2', password: 'newpass' } as any, adminContext());
    expect(mockHashPassword).toHaveBeenCalledWith('newpass');
  });

  it('non-admin gets FORBIDDEN', async () => {
    await expect(
      updateUser(null, { id: '2', username: 'x' } as any, authContext()),
    ).rejects.toThrow('Not authorized');
  });
});

describe('Mutation.deleteUser', () => {
  it('admin can delete another user', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ username: 'victim', email: 'v@t.com' }] }) // SELECT target
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // DELETE
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await deleteUser(null, { id: '2' }, adminContext({ userId: 1 }));
    expect(result).toBe(true);
  });

  it('prevents self-deletion', async () => {
    await expect(deleteUser(null, { id: '1' }, adminContext({ userId: 1 }))).rejects.toThrow(
      'Cannot delete your own account',
    );
  });

  it('non-admin gets FORBIDDEN', async () => {
    await expect(deleteUser(null, { id: '2' }, authContext())).rejects.toThrow('Not authorized');
  });

  it('returns false when user does not exist', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // SELECT target (not found)
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }); // DELETE (no rows affected)
    const result = await deleteUser(null, { id: '999' }, adminContext({ userId: 1 }));
    expect(result).toBe(false);
  });
});

describe('Mutation.requestPasswordReset', () => {
  it('always returns generic success message', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // no user found
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await requestPasswordReset(null, { email: 'no@one.com' }, anonContext());
    expect(result.success).toBe(true);
    expect(result.message).toContain('If an account exists');
  });

  it('generates token and sends email for valid user', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, email: 'a@b.com', is_active: true }] })
      .mockResolvedValueOnce({ rows: [] }) // DELETE existing tokens
      .mockResolvedValueOnce({ rows: [] }) // INSERT new token
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    mockGenerateResetToken.mockReturnValue('raw-token');
    mockHashResetToken.mockReturnValue('hashed-token');
    mockSendPasswordResetEmail.mockResolvedValue(undefined);

    const result = await requestPasswordReset(null, { email: 'a@b.com' }, anonContext());
    expect(result.success).toBe(true);
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith('a@b.com', 'raw-token');
  });

  it('does not reveal whether email exists', async () => {
    // Non-existent email
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    const result1 = await requestPasswordReset(
      null,
      { email: 'fake@fake.com' },
      { ...anonContext(), ipAddress: '10.0.0.2' },
    );

    // Existing email
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, email: 'real@r.com', is_active: true }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    mockGenerateResetToken.mockReturnValue('t');
    mockHashResetToken.mockReturnValue('h');
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
    const result2 = await requestPasswordReset(
      null,
      { email: 'real@r.com' },
      { ...anonContext(), ipAddress: '10.0.0.3' },
    );

    expect(result1.message).toBe(result2.message);
  });
});

describe('Mutation.resetPassword', () => {
  it('throws BAD_USER_INPUT for password too short', async () => {
    await expect(
      resetPassword(null, { token: 'abc', newPassword: '12345' }, anonContext()),
    ).rejects.toThrow('Password must be at least 6 characters');
  });

  it('throws BAD_USER_INPUT for empty password', async () => {
    await expect(
      resetPassword(null, { token: 'abc', newPassword: '' }, anonContext()),
    ).rejects.toThrow('Password must be at least 6 characters');
  });

  it('throws BAD_USER_INPUT for invalid/expired token', async () => {
    mockHashResetToken.mockReturnValue('bad-hash');
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // no matching token
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    await expect(
      resetPassword(null, { token: 'bad', newPassword: 'newpass123' }, anonContext()),
    ).rejects.toThrow('Invalid or expired reset token');
  });

  it('throws FORBIDDEN for disabled account', async () => {
    mockHashResetToken.mockReturnValue('hash');
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, user_id: 5, is_active: false }],
    });
    await expect(
      resetPassword(null, { token: 'tok', newPassword: 'newpass123' }, anonContext()),
    ).rejects.toThrow('Account is disabled');
  });

  it('updates password and marks token used for valid token', async () => {
    mockHashResetToken.mockReturnValue('valid-hash');
    mockHashPassword.mockResolvedValue('new-pw-hash');
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 10, user_id: 5, is_active: true }] }) // valid token
      .mockResolvedValueOnce({ rows: [] }) // UPDATE password
      .mockResolvedValueOnce({ rows: [] }) // mark token used
      .mockResolvedValueOnce({ rows: [] }) // delete other tokens
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await resetPassword(
      null,
      { token: 'valid', newPassword: 'newpass123' },
      anonContext(),
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain('reset successfully');
  });
});
