import { mockQuery, authContext, anonContext } from './__helpers';
import { resolvers } from '../../resolvers';

const { sendConnectionRequest, respondToConnectionRequest, removeConnection } = resolvers.Mutation;

describe('Mutation.sendConnectionRequest', () => {
  it('creates new pending connection request', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // target user exists
      .mockResolvedValueOnce({ rows: [] }) // no reverse request
      .mockResolvedValueOnce({ rows: [] }) // no forward request
      .mockResolvedValueOnce({
        rows: [{ id: 10, created_at: new Date('2024-01-01') }],
      }) // INSERT
      .mockResolvedValueOnce({ rows: [] }) // logAudit
      .mockResolvedValueOnce({
        rows: [{ id: 2, username: 'bob', display_name: 'Bob' }],
      }); // other user lookup
    const result = await sendConnectionRequest(
      null,
      { addresseeId: '2' },
      authContext({ userId: 1 }),
    );
    expect(result.status).toBe('pending');
    expect(result.direction).toBe('sent');
  });

  it('throws BAD_USER_INPUT for self-connection', async () => {
    await expect(
      sendConnectionRequest(null, { addresseeId: '1' }, authContext({ userId: 1 })),
    ).rejects.toThrow('Cannot connect with yourself');
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(sendConnectionRequest(null, { addresseeId: '2' }, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('target user not found throws NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // target not found
    await expect(
      sendConnectionRequest(null, { addresseeId: '999' }, authContext({ userId: 1 })),
    ).rejects.toThrow('User not found');
  });

  it('auto-accepts reverse pending request', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // target exists
      .mockResolvedValueOnce({ rows: [{ id: 5, status: 'pending' }] }) // reverse pending
      .mockResolvedValueOnce({ rows: [] }) // UPDATE to accepted
      .mockResolvedValueOnce({ rows: [] }) // logAudit
      .mockResolvedValueOnce({
        rows: [{ id: 2, username: 'bob', display_name: 'Bob' }],
      }); // other user
    const result = await sendConnectionRequest(
      null,
      { addresseeId: '2' },
      authContext({ userId: 1 }),
    );
    expect(result.status).toBe('accepted');
  });

  it('throws BAD_USER_INPUT when already connected (reverse)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // target exists
      .mockResolvedValueOnce({ rows: [{ id: 5, status: 'accepted' }] }); // reverse accepted
    await expect(
      sendConnectionRequest(null, { addresseeId: '2' }, authContext({ userId: 1 })),
    ).rejects.toThrow('Already connected');
  });

  it('throws BAD_USER_INPUT when forward request already pending', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // target exists
      .mockResolvedValueOnce({ rows: [] }) // no reverse
      .mockResolvedValueOnce({ rows: [{ id: 6, status: 'pending' }] }); // forward pending
    await expect(
      sendConnectionRequest(null, { addresseeId: '2' }, authContext({ userId: 1 })),
    ).rejects.toThrow('Request already pending');
  });

  it('re-sends previously rejected request', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // target exists
      .mockResolvedValueOnce({ rows: [] }) // no reverse
      .mockResolvedValueOnce({ rows: [{ id: 6, status: 'rejected' }] }) // forward rejected
      .mockResolvedValueOnce({ rows: [] }) // UPDATE to pending
      .mockResolvedValueOnce({ rows: [] }) // logAudit
      .mockResolvedValueOnce({
        rows: [{ id: 2, username: 'bob', display_name: 'Bob' }],
      });
    const result = await sendConnectionRequest(
      null,
      { addresseeId: '2' },
      authContext({ userId: 1 }),
    );
    expect(result.status).toBe('pending');
  });
});

describe('Mutation.respondToConnectionRequest', () => {
  it('accept=true updates to accepted', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 10, requester_id: 2, addressee_id: 1, created_at: new Date() }],
      }) // SELECT pending
      .mockResolvedValueOnce({ rows: [] }) // UPDATE
      .mockResolvedValueOnce({ rows: [] }) // logAudit
      .mockResolvedValueOnce({
        rows: [{ id: 2, username: 'bob', display_name: 'Bob' }],
      }); // other user
    const result = await respondToConnectionRequest(
      null,
      { connectionId: '10', accept: true },
      authContext({ userId: 1 }),
    );
    expect(result.status).toBe('accepted');
  });

  it('accept=false updates to rejected', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 10, requester_id: 2, addressee_id: 1, created_at: new Date() }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: 2, username: 'bob', display_name: 'Bob' }],
      });
    const result = await respondToConnectionRequest(
      null,
      { connectionId: '10', accept: false },
      authContext({ userId: 1 }),
    );
    expect(result.status).toBe('rejected');
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(
      respondToConnectionRequest(null, { connectionId: '10', accept: true }, anonContext()),
    ).rejects.toThrow('Not authenticated');
  });

  it('request not found throws NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      respondToConnectionRequest(null, { connectionId: '999', accept: true }, authContext()),
    ).rejects.toThrow('Connection request not found');
  });
});

describe('Mutation.removeConnection', () => {
  it('removes connection', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 10 }] }) // DELETE RETURNING
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await removeConnection(null, { connectionId: '10' }, authContext());
    expect(result).toBe(true);
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(removeConnection(null, { connectionId: '10' }, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('connection not found throws NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(removeConnection(null, { connectionId: '999' }, authContext())).rejects.toThrow(
      'Connection not found',
    );
  });
});
