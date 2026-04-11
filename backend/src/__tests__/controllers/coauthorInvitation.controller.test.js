jest.mock('../../config/supabase', () => ({
  from: jest.fn(),
}));

jest.mock('../../utils/name', () => ({
  attachFullName: jest.fn((value) => value),
  buildFullName: jest.fn(() => 'Test User'),
}));

jest.mock('../../utils/mailer', () => ({
  sendTransactionalEmail: jest.fn().mockResolvedValue(undefined),
}));

const supabase = require('../../config/supabase');
const controller = require('../../controllers/coauthorInvitation.controller');

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('coauthorInvitation controller compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getMyCoAuthorInvitations normalizes responded_at for accepted invitations', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'co_author_invitations') {
        const query = {
          eq: jest.fn().mockReturnThis(),
          order: async () => ({
            data: [
              {
                id: 'invite-1',
                research_id: 'paper-1',
                inviter_id: 'user-1',
                invitee_id: 'user-2',
                token: 'token-1',
                status: 'accepted',
                responded_at: '2026-04-10T01:00:00.000Z',
                created_at: '2026-04-01T00:00:00.000Z',
              },
            ],
            error: null,
          }),
        };

        return {
          select: () => query,
        };
      }

      if (table === 'research_papers') {
        return {
          select: () => ({
            in: async () => ({
              data: [{ id: 'paper-1', title: 'Paper' }],
              error: null,
            }),
          }),
        };
      }

      if (table === 'users') {
        return {
          select: () => ({
            in: async () => ({
              data: [{ id: 'user-1', first_name: 'Inviter', middle_name: null, last_name: 'One', email: 'inviter@example.com' }],
              error: null,
            }),
          }),
        };
      }

      return {};
    });

    const req = { query: {}, user: { id: 'user-2' } };
    const res = createRes();

    await controller.getMyCoAuthorInvitations(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.invitations[0].responded_at).toBe('2026-04-10T01:00:00.000Z');
    expect(payload.data.invitations[0].accepted_at).toBe('2026-04-10T01:00:00.000Z');
    expect(payload.data.invitations[0].declined_at).toBeNull();
  });

  test('acceptCoAuthorInvitation falls back to accepted_at when responded_at is unavailable', async () => {
    const updatePayloads = [];
    let invitationCall = 0;

    supabase.from.mockImplementation((table) => {
      if (table === 'co_author_invitations') {
        invitationCall += 1;

        if (invitationCall === 1) {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'invite-1',
                    research_id: 'paper-1',
                    inviter_id: 'user-1',
                    invitee_id: 'user-2',
                    status: 'pending',
                    expires_at: '2026-12-31T00:00:00.000Z',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (invitationCall === 2) {
          return {
            update: (payload) => {
              updatePayloads.push(payload);
              return {
                eq: async () => ({
                  error: { message: 'column responded_at does not exist' },
                }),
              };
            },
          };
        }

        return {
          update: (payload) => {
            updatePayloads.push(payload);
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }

      if (table === 'research_papers') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 'paper-1', title: 'Paper' },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'research_authors') {
        return {
          select: () => ({
            eq: jest.fn().mockReturnThis(),
            maybeSingle: async () => ({
              data: { id: 'author-row-1' },
              error: null,
            }),
          }),
        };
      }

      if (table === 'notifications') {
        return {
          insert: async () => ({ error: null }),
        };
      }

      return {};
    });

    const req = {
      params: { token: 'token-1' },
      user: { id: 'user-2', email: 'invitee@example.com' },
    };
    const res = createRes();

    await controller.acceptCoAuthorInvitation(req, res);

    expect(updatePayloads).toHaveLength(2);
    expect(updatePayloads[0]).toEqual(expect.objectContaining({ status: 'accepted' }));
    expect(updatePayloads[0]).toHaveProperty('responded_at');
    expect(updatePayloads[1]).toEqual(expect.objectContaining({ status: 'accepted' }));
    expect(updatePayloads[1]).toHaveProperty('accepted_at');

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.message).toBe('Invitation accepted');
  });
});
