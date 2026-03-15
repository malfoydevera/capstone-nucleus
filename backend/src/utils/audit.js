const supabase = require('../config/supabase');

/**
 * Log an audit event to the audit_logs table.
 *
 * @param {Object} params
 * @param {string} params.userId      - UUID of the user performing the action
 * @param {string} params.userRole    - Role of the user (e.g. 'dean', 'program_chair')
 * @param {string} params.userName    - Display name of the user
 * @param {string} params.action      - Action type: 'approve', 'reject', 'revision', 'bypass', 'login', etc.
 * @param {string} [params.targetType]  - 'research_paper', 'user', or 'system'
 * @param {string} [params.targetId]    - UUID of the target entity
 * @param {Object} [params.details]     - Additional JSONB details (e.g. { previousStatus, newStatus })
 * @param {string} [params.reason]      - Human-readable reason (required for bypass)
 * @param {string} [params.ipAddress]   - Client IP address
 */
async function logAuditEvent({
  userId,
  userRole,
  userName,
  action,
  targetType = null,
  targetId = null,
  details = {},
  reason = null,
  ipAddress = null,
}) {
  try {
    const { error } = await supabase.from('audit_logs').insert([{
      user_id: userId,
      user_role: userRole,
      user_name: userName || null,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      reason,
      ip_address: ipAddress,
    }]);

    if (error) {
      console.error('Audit log insert error:', error.message);
    }
  } catch (err) {
    // Never let audit logging break the main flow
    console.error('Audit log exception:', err.message);
  }
}

module.exports = { logAuditEvent };
