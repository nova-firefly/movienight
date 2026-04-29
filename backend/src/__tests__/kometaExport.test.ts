const mockQuery = jest.fn();
jest.mock('../db', () => ({
  __esModule: true,
  default: { query: mockQuery },
}));

const mockCreateList = jest.fn();
const mockSyncList = jest.fn();
jest.mock('../mdblist', () => ({
  createList: (...args: any[]) => mockCreateList(...args),
  syncList: (...args: any[]) => mockSyncList(...args),
}));

const mockWriteFile = jest.fn();
jest.mock('fs', () => ({
  promises: { writeFile: mockWriteFile },
}));

import { runKometaExport, generateMultiCollectionYaml, ExportListResult } from '../kometaExport';

beforeEach(() => {
  jest.clearAllMocks();
  mockWriteFile.mockResolvedValue(undefined);
});

describe('generateMultiCollectionYaml', () => {
  it('generates YAML with quoted collection names for & safety', () => {
    const lists: ExportListResult[] = [
      {
        name: 'Alice & Bob',
        type: 'combined',
        movieCount: 3,
        mdblistUrl: 'https://mdblist.com/lists/u/alice-bob',
      },
      {
        name: 'Just Charlie',
        type: 'solo',
        movieCount: 1,
        mdblistUrl: 'https://mdblist.com/lists/u/just-charlie',
      },
    ];
    const yaml = generateMultiCollectionYaml(lists);
    expect(yaml).toContain('"Alice & Bob":');
    expect(yaml).toContain('"Just Charlie":');
    expect(yaml).toContain('mdblist_list: https://mdblist.com/lists/u/alice-bob');
    expect(yaml).toContain('collection_order: custom');
    expect(yaml).toContain('sync_mode: sync');
    expect(yaml).toContain('radarr_add_missing: true');
  });

  it('generates empty collections section when no lists', () => {
    const yaml = generateMultiCollectionYaml([]);
    expect(yaml).toContain('collections:\n');
    // No collection entries
    expect(yaml).not.toContain('mdblist_list:');
  });
});

describe('runKometaExport', () => {
  it('exports combined list for an accepted connection', async () => {
    // getAcceptedConnections query
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          connection_id: 10,
          u1_id: 1,
          u1_display: 'Alice',
          u1_username: 'alice',
          u2_id: 2,
          u2_display: 'Bob',
          u2_username: 'bob',
        },
      ],
    });
    // getCombinedTmdbIds query (for connection 10)
    mockQuery.mockResolvedValueOnce({
      rows: [{ tmdb_id: 100 }, { tmdb_id: 200 }],
    });
    // getOrCreateMdbList: SELECT existing
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // createList
    mockCreateList.mockResolvedValueOnce({
      id: 42,
      slug: 'alice-bob',
      url: 'https://mdblist.com/lists/u/alice-bob',
    });
    // INSERT kometa_mdblist_lists
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // syncList
    mockSyncList.mockResolvedValueOnce(undefined);

    // getUsersWithConnections query
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, display_name: 'Alice', username: 'alice' },
        { id: 2, display_name: 'Bob', username: 'bob' },
      ],
    });
    // getSoloTmdbIds for user 1 (empty = no solo movies)
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // getSoloTmdbIds for user 2 (empty)
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await runKometaExport('/tmp/kometa', 'test-key');

    expect(result.lists).toHaveLength(1);
    expect(result.lists[0].name).toBe('Alice & Bob');
    expect(result.lists[0].type).toBe('combined');
    expect(result.lists[0].movieCount).toBe(2);
    expect(mockSyncList).toHaveBeenCalledWith('test-key', 42, [100, 200]);
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/kometa/movienight.yml',
      expect.stringContaining('"Alice & Bob":'),
      'utf8',
    );
  });

  it('exports solo list when all connections passed', async () => {
    // getAcceptedConnections (empty — no combined lists)
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // getUsersWithConnections
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, display_name: 'Alice', username: 'alice' }],
    });
    // getSoloTmdbIds for user 1
    mockQuery.mockResolvedValueOnce({
      rows: [{ tmdb_id: 300 }],
    });
    // getOrCreateMdbList: SELECT existing
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // createList
    mockCreateList.mockResolvedValueOnce({
      id: 55,
      slug: 'just-alice',
      url: 'https://mdblist.com/lists/u/just-alice',
    });
    // INSERT
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // syncList
    mockSyncList.mockResolvedValueOnce(undefined);

    const result = await runKometaExport('/tmp/kometa', 'test-key');

    expect(result.lists).toHaveLength(1);
    expect(result.lists[0].name).toBe('Just Alice');
    expect(result.lists[0].type).toBe('solo');
    expect(result.lists[0].movieCount).toBe(1);
    expect(mockSyncList).toHaveBeenCalledWith('test-key', 55, [300]);
  });

  it('reuses existing MDBList list on subsequent exports', async () => {
    // getAcceptedConnections
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          connection_id: 10,
          u1_id: 1,
          u1_display: 'Alice',
          u1_username: 'alice',
          u2_id: 2,
          u2_display: 'Bob',
          u2_username: 'bob',
        },
      ],
    });
    // getCombinedTmdbIds
    mockQuery.mockResolvedValueOnce({
      rows: [{ tmdb_id: 100 }],
    });
    // getOrCreateMdbList: SELECT existing — list already exists
    mockQuery.mockResolvedValueOnce({
      rows: [{ mdblist_list_id: 42, mdblist_list_url: 'https://mdblist.com/lists/u/alice-bob' }],
    });
    // syncList
    mockSyncList.mockResolvedValueOnce(undefined);
    // getUsersWithConnections
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await runKometaExport('/tmp/kometa', 'test-key');

    expect(mockCreateList).not.toHaveBeenCalled();
    expect(mockSyncList).toHaveBeenCalledWith('test-key', 42, [100]);
  });

  it('skips empty combined lists (no TMDB-matched movies)', async () => {
    // getAcceptedConnections
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          connection_id: 10,
          u1_id: 1,
          u1_display: 'Alice',
          u1_username: 'alice',
          u2_id: 2,
          u2_display: 'Bob',
          u2_username: 'bob',
        },
      ],
    });
    // getCombinedTmdbIds — empty
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // getUsersWithConnections
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await runKometaExport('/tmp/kometa', 'test-key');

    expect(result.lists).toHaveLength(0);
    expect(mockCreateList).not.toHaveBeenCalled();
    expect(mockSyncList).not.toHaveBeenCalled();
  });

  it('sorts pair names alphabetically for consistent naming', async () => {
    // getAcceptedConnections — Bob is requester, Alice is addressee
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          connection_id: 10,
          u1_id: 2,
          u1_display: 'Zara',
          u1_username: 'zara',
          u2_id: 1,
          u2_display: 'Alice',
          u2_username: 'alice',
        },
      ],
    });
    // getCombinedTmdbIds
    mockQuery.mockResolvedValueOnce({
      rows: [{ tmdb_id: 100 }],
    });
    // getOrCreateMdbList
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockCreateList.mockResolvedValueOnce({
      id: 1,
      slug: 's',
      url: 'https://mdblist.com/lists/u/s',
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockSyncList.mockResolvedValueOnce(undefined);
    // getUsersWithConnections
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await runKometaExport('/tmp/kometa', 'test-key');

    // Alice should come first alphabetically
    expect(result.lists[0].name).toBe('Alice & Zara');
  });

  it('falls back to username when display_name is null', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          connection_id: 10,
          u1_id: 1,
          u1_display: null,
          u1_username: 'alice',
          u2_id: 2,
          u2_display: null,
          u2_username: 'bob',
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ tmdb_id: 100 }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockCreateList.mockResolvedValueOnce({
      id: 1,
      slug: 's',
      url: 'https://mdblist.com/lists/u/s',
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockSyncList.mockResolvedValueOnce(undefined);
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await runKometaExport('/tmp/kometa', 'test-key');

    expect(result.lists[0].name).toBe('alice & bob');
  });

  it('exports both combined and solo lists in one run', async () => {
    // getAcceptedConnections
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          connection_id: 10,
          u1_id: 1,
          u1_display: 'Alice',
          u1_username: 'alice',
          u2_id: 2,
          u2_display: 'Bob',
          u2_username: 'bob',
        },
      ],
    });
    // getCombinedTmdbIds
    mockQuery.mockResolvedValueOnce({
      rows: [{ tmdb_id: 100 }, { tmdb_id: 200 }],
    });
    // getOrCreateMdbList for combined
    mockQuery.mockResolvedValueOnce({
      rows: [{ mdblist_list_id: 42, mdblist_list_url: 'https://mdblist.com/lists/u/combined' }],
    });
    mockSyncList.mockResolvedValueOnce(undefined);

    // getUsersWithConnections
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, display_name: 'Alice', username: 'alice' },
        { id: 2, display_name: 'Bob', username: 'bob' },
      ],
    });
    // getSoloTmdbIds for user 1
    mockQuery.mockResolvedValueOnce({
      rows: [{ tmdb_id: 500 }],
    });
    // getOrCreateMdbList for solo Alice
    mockQuery.mockResolvedValueOnce({
      rows: [{ mdblist_list_id: 55, mdblist_list_url: 'https://mdblist.com/lists/u/solo-alice' }],
    });
    mockSyncList.mockResolvedValueOnce(undefined);
    // getSoloTmdbIds for user 2 (empty)
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await runKometaExport('/tmp/kometa', 'test-key');

    expect(result.lists).toHaveLength(2);
    expect(result.lists[0]).toEqual(
      expect.objectContaining({ name: 'Alice & Bob', type: 'combined', movieCount: 2 }),
    );
    expect(result.lists[1]).toEqual(
      expect.objectContaining({ name: 'Just Alice', type: 'solo', movieCount: 1 }),
    );

    // YAML should contain both collections
    const writtenYaml = mockWriteFile.mock.calls[0][1];
    expect(writtenYaml).toContain('"Alice & Bob":');
    expect(writtenYaml).toContain('"Just Alice":');
  });
});
