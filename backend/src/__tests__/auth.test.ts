import {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  getTokenFromHeader,
  generateResetToken,
  hashResetToken,
} from '../auth';

const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  display_name: 'Test User',
  is_admin: false,
  is_active: true,
  last_login_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('hashPassword', () => {
  it('returns a bcrypt hash string', async () => {
    const hash = await hashPassword('password123');
    expect(hash).toMatch(/^\$2[aby]\$\d+\$/);
  });

  it('uses 10 salt rounds', async () => {
    const hash = await hashPassword('password123');
    expect(hash).toContain('$2b$10$');
  });

  it('produces different hashes for the same input', async () => {
    const hash1 = await hashPassword('password123');
    const hash2 = await hashPassword('password123');
    expect(hash1).not.toBe(hash2);
  });
});

describe('comparePassword', () => {
  it('returns true for matching password and hash', async () => {
    const hash = await hashPassword('password123');
    const result = await comparePassword('password123', hash);
    expect(result).toBe(true);
  });

  it('returns false for non-matching password', async () => {
    const hash = await hashPassword('password123');
    const result = await comparePassword('wrongpassword', hash);
    expect(result).toBe(false);
  });
});

describe('generateToken', () => {
  it('returns a JWT string with 3 dot-separated segments', () => {
    const token = generateToken(mockUser);
    expect(token.split('.')).toHaveLength(3);
  });

  it('embeds userId, username, isAdmin in payload', () => {
    const token = generateToken(mockUser);
    const payload = verifyToken(token);
    expect(payload).toMatchObject({
      userId: 1,
      username: 'testuser',
      isAdmin: false,
    });
  });

  it('sets 7-day expiry', () => {
    const token = generateToken(mockUser);
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const expiresIn = decoded.exp - decoded.iat;
    expect(expiresIn).toBe(7 * 24 * 60 * 60);
  });
});

describe('verifyToken', () => {
  it('returns JWTPayload for a valid token', () => {
    const token = generateToken(mockUser);
    const payload = verifyToken(token);
    expect(payload).toMatchObject({
      userId: 1,
      username: 'testuser',
      isAdmin: false,
    });
  });

  it('returns null for a malformed string', () => {
    expect(verifyToken('not.a.token')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(verifyToken('')).toBeNull();
  });

  it('returns null for a token signed with a different secret', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const jwt = require('jsonwebtoken');
    const fakeToken = jwt.sign({ userId: 1 }, 'wrong-secret', { expiresIn: '7d' });
    expect(verifyToken(fakeToken)).toBeNull();
  });
});

describe('getTokenFromHeader', () => {
  it('returns token from "Bearer <token>" format', () => {
    expect(getTokenFromHeader('Bearer abc123')).toBe('abc123');
  });

  it('returns null for undefined input', () => {
    expect(getTokenFromHeader(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getTokenFromHeader('')).toBeNull();
  });

  it('returns null for wrong scheme (Basic)', () => {
    expect(getTokenFromHeader('Basic abc123')).toBeNull();
  });

  it('returns null for lowercase bearer', () => {
    expect(getTokenFromHeader('bearer abc123')).toBeNull();
  });

  it('returns null for "Bearer" with no token', () => {
    expect(getTokenFromHeader('Bearer')).toBeNull();
  });

  it('returns null for too many parts', () => {
    expect(getTokenFromHeader('Bearer token extra')).toBeNull();
  });
});

describe('generateResetToken', () => {
  it('returns a 64-character hex string', () => {
    const token = generateResetToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces unique values on successive calls', () => {
    const token1 = generateResetToken();
    const token2 = generateResetToken();
    expect(token1).not.toBe(token2);
  });
});

describe('hashResetToken', () => {
  it('returns a 64-character hex SHA256 hash', () => {
    const hash = hashResetToken('some-token');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    const hash1 = hashResetToken('same-token');
    const hash2 = hashResetToken('same-token');
    expect(hash1).toBe(hash2);
  });

  it('different inputs produce different outputs', () => {
    const hash1 = hashResetToken('token-a');
    const hash2 = hashResetToken('token-b');
    expect(hash1).not.toBe(hash2);
  });
});
