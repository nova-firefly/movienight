// Mock pool - must be before resolvers import
export const mockQuery = jest.fn();
jest.mock('../../db', () => ({
  __esModule: true,
  default: { query: mockQuery },
}));

// Mock auth module
export const mockHashPassword = jest.fn();
export const mockComparePassword = jest.fn();
export const mockGenerateToken = jest.fn();
export const mockGenerateResetToken = jest.fn();
export const mockHashResetToken = jest.fn();
jest.mock('../../auth', () => ({
  hashPassword: (...args: any[]) => mockHashPassword(...args),
  comparePassword: (...args: any[]) => mockComparePassword(...args),
  generateToken: (...args: any[]) => mockGenerateToken(...args),
  generateResetToken: (...args: any[]) => mockGenerateResetToken(...args),
  hashResetToken: (...args: any[]) => mockHashResetToken(...args),
}));

// Mock email
export const mockSendPasswordResetEmail = jest.fn();
jest.mock('../../email', () => ({
  sendPasswordResetEmail: (...args: any[]) => mockSendPasswordResetEmail(...args),
}));

// Mock push — default to a no-op resolved promise so call sites that
// fire-and-forget don't blow up when tests don't explicitly set a return value.
export const mockSendPushToConnectionsOf: jest.Mock = jest.fn();
mockSendPushToConnectionsOf.mockResolvedValue({ delivered: 0, pruned: 0 });
jest.mock('../../push', () => ({
  sendPushToConnectionsOf: (...args: any[]) => mockSendPushToConnectionsOf(...args),
  configurePush: jest.fn(),
  isPushConfigured: jest.fn(() => false),
}));

// Mock scheduler
export const mockRescheduleKometa = jest.fn();
jest.mock('../../scheduler', () => ({
  rescheduleKometa: (...args: any[]) => mockRescheduleKometa(...args),
}));

// Mock mdblist
export const mockCreateList = jest.fn();
export const mockSyncList = jest.fn();
jest.mock('../../mdblist', () => ({
  createList: (...args: any[]) => mockCreateList(...args),
  syncList: (...args: any[]) => mockSyncList(...args),
}));

// Mock kometaExport (used by both manual export resolvers and the
// fire-and-forget MDBList re-sync triggered by markWatched/unwatchMovie).
// Default to a no-op resolved value so background syncs don't blow up other
// tests; per-test code can override with mockResolvedValueOnce as needed.
export const mockRunKometaExport = jest.fn().mockResolvedValue({
  filePath: null,
  yamlContent: '',
  lists: [],
});
jest.mock('../../kometaExport', () => ({
  runKometaExport: (...args: any[]) => mockRunKometaExport(...args),
}));

// Mock elo
export const mockApplyComparison = jest.fn();
export const mockUpdateGlobalEloRank = jest.fn();
jest.mock('../../elo', () => ({
  applyComparison: (...args: any[]) => mockApplyComparison(...args),
  updateGlobalEloRank: (...args: any[]) => mockUpdateGlobalEloRank(...args),
}));

// Mock pairSelection
export const mockSelectPair = jest.fn();
jest.mock('../../pairSelection', () => ({
  selectPair: (...args: any[]) => mockSelectPair(...args),
}));

// Mock fs (for Kometa export)
export const mockWriteFile = jest.fn();
jest.mock('fs', () => ({
  promises: { writeFile: mockWriteFile },
}));

// Mock global fetch
export const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// Context factories
export function authContext(
  overrides?: Partial<{ userId: number; isAdmin: boolean; username: string }>,
) {
  return {
    user: { userId: 1, isAdmin: false, username: 'testuser', ...overrides },
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  };
}

export function adminContext(overrides?: Partial<{ userId: number }>) {
  return authContext({ isAdmin: true, username: 'admin', ...overrides });
}

export function anonContext() {
  return { user: null, ipAddress: '127.0.0.1', userAgent: 'test-agent' };
}
