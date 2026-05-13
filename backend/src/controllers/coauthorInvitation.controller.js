const crypto = require('crypto');
const supabase = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { attachFullName, buildFullName } = require('../utils/name');
const { sendTransactionalEmail } = require('../utils/mailer');
const { notifyUser } = require('../utils/notify');

const INVITE_TTL_DAYS = 7;

const buildInvitationLink = (token) => {
  const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${baseUrl}/student/co-author-invitations?token=${token}`;
};

const normalizeInvitationRow = (row) => {
  const respondedAt = row.responded_at || row.accepted_at || row.declined_at || null;

  return {
    ...row,
    responded_at: respondedAt,
    accepted_at: row.accepted_at || (row.status === 'accepted' ? respondedAt : null),
    declined_at: row.declined_at || (row.status === 'declined' ? respondedAt : null),
  };
};

const updateInvitationResponse = async ({ invitationId, status, respondedAt }) => {
  const primaryResult = await supabase
    .from('co_author_invitations')
    .update({ status, responded_at: respondedAt })
    .eq('id', invitationId);

  if (!primaryResult.error) {
    return null;
  }

  if (!String(primaryResult.error.message || '').includes('responded_at')) {
    return primaryResult.error;
  }

  const fallbackTimestampColumn = status === 'accepted' ? 'accepted_at' : 'declined_at';
  const fallbackResult = await supabase
    .from('co_author_invitations')
    .update({ status, [fallbackTimestampColumn]: respondedAt })
    .eq('id', invitationId);

  return fallbackResult.error || null;
};

exports.createCoAuthorInvitations = async (req, res) => {
  try {
    const { id: researchId } = req.params;
    const { inviteeIds } = req.body;

    if (!Array.isArray(inviteeIds) || inviteeIds.length === 0) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'inviteeIds must be a non-empty array',
      });
    }

    const uniqueInviteeIds = [...new Set(inviteeIds.filter(Boolean))];
    if (uniqueInviteeIds.length === 0) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'No valid invitee IDs were provided',
      });
    }

    const { data: paper, error: paperError } = await supabase
      .from('research_papers')
      .select('id, title, author_id')
      .eq('id', researchId)
      .single();

    if (paperError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }

    if (paper.author_id !== req.user.id) {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Only the paper author can invite co-authors' });
    }

    const { data: candidateUsers, error: userError } = await supabase
      .from('users')
      .select('id, first_name, middle_name, last_name, email, role')
      .in('id', uniqueInviteeIds)
      .eq('role', 'student');

    if (userError) throw userError;

    const candidateMap = new Map((candidateUsers || []).map((u) => [u.id, u]));

    const { data: existingAuthors } = await supabase
      .from('research_authors')
      .select('user_id')
      .eq('research_id', researchId)
      .in('user_id', uniqueInviteeIds);

    const existingAuthorSet = new Set((existingAuthors || []).map((a) => a.user_id));

    const { data: pendingInvites } = await supabase
      .from('co_author_invitations')
      .select('invitee_id')
      .eq('research_id', researchId)
      .eq('status', 'pending')
      .in('invitee_id', uniqueInviteeIds);

    const pendingInviteSet = new Set((pendingInvites || []).map((i) => i.invitee_id));

    const created = [];
    const skipped = [];

    for (const inviteeId of uniqueInviteeIds) {
      const candidate = candidateMap.get(inviteeId);

      if (!candidate) {
        skipped.push({ inviteeId, reason: 'USER_NOT_FOUND_OR_NOT_STUDENT' });
        continue;
      }

      if (inviteeId === req.user.id) {
        skipped.push({ inviteeId, reason: 'CANNOT_INVITE_SELF' });
        continue;
      }

      if (existingAuthorSet.has(inviteeId)) {
        skipped.push({ inviteeId, reason: 'ALREADY_COAUTHOR' });
        continue;
      }

      if (pendingInviteSet.has(inviteeId)) {
        skipped.push({ inviteeId, reason: 'INVITATION_ALREADY_PENDING' });
        continue;
      }

      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const { data: invite, error: inviteError } = await supabase
        .from('co_author_invitations')
        .insert({
          research_id: researchId,
          inviter_id: req.user.id,
          invitee_id: inviteeId,
          invitee_email: candidate.email,
          token,
          status: 'pending',
          expires_at: expiresAt,
        })
        .select('id, invitee_id, invitee_email, token, expires_at')
        .single();

      if (inviteError) {
        if (String(inviteError.message || '').includes('co_author_invitations')) {
          return sendError(res, {
            status: 500,
            code: 'FEATURE_NOT_READY',
            message: 'Co-author invitations table is missing. Apply migration add_co_author_invitations.sql first.',
          });
        }
        skipped.push({ inviteeId, reason: 'CREATE_INVITATION_FAILED' });
        continue;
      }

      created.push(invite);

      await notifyUser({
        userId: inviteeId,
        researchId,
        type: 'coauthor_invite',
        title: 'Co-author Invitation',
        message: `You were invited to co-author "${paper.title}". Open your invitations to accept or decline.`,
      });

      const inviteeName = buildFullName(candidate) || candidate.email;
      const invitationLink = buildInvitationLink(token);
      await sendTransactionalEmail({
        to: candidate.email,
        subject: 'NUCLEUS Co-author Invitation',
        text: [
          `Hello ${inviteeName},`,
          '',
          `You have been invited to join as co-author for "${paper.title}".`,
          `Accept invitation: ${invitationLink}`,
          '',
          `This invitation expires on ${new Date(expiresAt).toLocaleString()}.`,
        ].join('\n'),
      });
    }

    return sendSuccess(res, {
      message: 'Co-author invitations processed',
      data: { created, skipped, totalRequested: uniqueInviteeIds.length },
    });
  } catch (error) {
    console.error('Create co-author invitations error:', error);
    return sendError(res, {
      status: 500,
      code: 'CREATE_COAUTHOR_INVITES_FAILED',
      message: 'Server error',
    });
  }
};

exports.getMyCoAuthorInvitations = async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('co_author_invitations')
      .select('*')
      .eq('invitee_id', req.user.id)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data: invitations, error } = await query;
    if (error) {
      if (String(error.message || '').includes('co_author_invitations')) {
        return sendSuccess(res, { data: { invitations: [] } });
      }
      throw error;
    }

    const invitationRows = invitations || [];
    if (invitationRows.length === 0) {
      return sendSuccess(res, { data: { invitations: [] } });
    }

    const researchIds = [...new Set(invitationRows.map((i) => i.research_id))];
    const inviterIds = [...new Set(invitationRows.map((i) => i.inviter_id))];

    const [researchResult, inviterResult] = await Promise.all([
      supabase.from('research_papers').select('id, title').in('id', researchIds),
      supabase.from('users').select('id, first_name, middle_name, last_name, email').in('id', inviterIds),
    ]);

    const researchMap = new Map((researchResult.data || []).map((r) => [r.id, r]));
    const inviterMap = new Map((inviterResult.data || []).map((u) => [u.id, attachFullName(u)]));

    const enriched = invitationRows.map((row) => ({
      ...normalizeInvitationRow(row),
      research: researchMap.get(row.research_id) || null,
      inviter: inviterMap.get(row.inviter_id) || null,
    }));

    return sendSuccess(res, {
      data: {
        invitations: enriched,
        pendingCount: enriched.filter((inv) => inv.status === 'pending').length,
      },
    });
  } catch (error) {
    console.error('Get co-author invitations error:', error);
    return sendError(res, {
      status: 500,
      code: 'GET_COAUTHOR_INVITATIONS_FAILED',
      message: 'Server error',
    });
  }
};

exports.acceptCoAuthorInvitation = async (req, res) => {
  try {
    const { token } = req.params;

    const { data: invite, error: inviteError } = await supabase
      .from('co_author_invitations')
      .select('id, research_id, inviter_id, invitee_id, status, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (inviteError) throw inviteError;
    if (!invite) {
      return sendError(res, { status: 404, code: 'INVITATION_NOT_FOUND', message: 'Invitation not found' });
    }

    if (invite.invitee_id !== req.user.id) {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'This invitation is not assigned to you' });
    }

    if (invite.status !== 'pending') {
      return sendError(res, { status: 400, code: 'INVITATION_NOT_PENDING', message: `Invitation already ${invite.status}` });
    }

    const now = new Date();
    if (new Date(invite.expires_at) < now) {
      await supabase.from('co_author_invitations').update({ status: 'expired' }).eq('id', invite.id);
      return sendError(res, { status: 400, code: 'INVITATION_EXPIRED', message: 'Invitation has expired' });
    }

    const { data: paper, error: paperError } = await supabase
      .from('research_papers')
      .select('id, title')
      .eq('id', invite.research_id)
      .maybeSingle();

    if (paperError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }

    const { data: existingAuthor } = await supabase
      .from('research_authors')
      .select('id')
      .eq('research_id', invite.research_id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!existingAuthor) {
      const { data: lastAuthor } = await supabase
        .from('research_authors')
        .select('author_order')
        .eq('research_id', invite.research_id)
        .order('author_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const authorOrder = Math.max((lastAuthor?.author_order || 0) + 1, 1);

      await supabase.from('research_authors').upsert({
        research_id: invite.research_id,
        user_id: req.user.id,
        author_order: authorOrder,
        is_primary: false,
      }, { onConflict: 'research_id,user_id' });
    }

    const acceptError = await updateInvitationResponse({
      invitationId: invite.id,
      status: 'accepted',
      respondedAt: now.toISOString(),
    });
    if (acceptError) {
      throw acceptError;
    }

    await notifyUser({
      userId: invite.inviter_id,
      researchId: invite.research_id,
      type: 'coauthor_invite_accepted',
      title: 'Co-author Invitation Accepted',
      message: `${req.user.fullName || req.user.email} accepted your co-author invitation for "${paper.title}".`,
    });

    return sendSuccess(res, {
      message: 'Invitation accepted',
      data: { researchId: invite.research_id },
    });
  } catch (error) {
    console.error('Accept co-author invitation error:', error);
    return sendError(res, {
      status: 500,
      code: 'ACCEPT_COAUTHOR_INVITATION_FAILED',
      message: 'Server error',
    });
  }
};

exports.declineCoAuthorInvitation = async (req, res) => {
  try {
    const { token } = req.params;

    const { data: invite, error: inviteError } = await supabase
      .from('co_author_invitations')
      .select('id, research_id, inviter_id, invitee_id, status')
      .eq('token', token)
      .maybeSingle();

    if (inviteError) throw inviteError;
    if (!invite) {
      return sendError(res, { status: 404, code: 'INVITATION_NOT_FOUND', message: 'Invitation not found' });
    }

    if (invite.invitee_id !== req.user.id) {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'This invitation is not assigned to you' });
    }

    if (invite.status !== 'pending') {
      return sendError(res, { status: 400, code: 'INVITATION_NOT_PENDING', message: `Invitation already ${invite.status}` });
    }

    const declineError = await updateInvitationResponse({
      invitationId: invite.id,
      status: 'declined',
      respondedAt: new Date().toISOString(),
    });
    if (declineError) {
      throw declineError;
    }

    // Defensive cleanup: ensure declined users are not linked as co-authors.
    // This guarantees they no longer receive participant notifications.
    await supabase
      .from('research_authors')
      .delete()
      .eq('research_id', invite.research_id)
      .eq('user_id', req.user.id)
      .eq('is_primary', false);

    await notifyUser({
      userId: invite.inviter_id,
      researchId: invite.research_id,
      type: 'coauthor_invite_declined',
      title: 'Co-author Invitation Declined',
      message: `${req.user.fullName || req.user.email} declined your co-author invitation.`,
    });

    return sendSuccess(res, { message: 'Invitation declined', data: {} });
  } catch (error) {
    console.error('Decline co-author invitation error:', error);
    return sendError(res, {
      status: 500,
      code: 'DECLINE_COAUTHOR_INVITATION_FAILED',
      message: 'Server error',
    });
  }
};
