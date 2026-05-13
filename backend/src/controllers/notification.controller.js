const supabase = require('../config/supabase');

/**
 * Admin-only diagnostic endpoint.
 * Returns the most recent notifications grouped by user_id so we can
 * verify whether each role is actually receiving inserts.
 */
exports.getNotificationsDebug = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, research_id, type, title, message, is_read, created_at, users!inner(id, role, email)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const groupedByUser = {};
    const groupedByRole = {};
    for (const row of data || []) {
      const uid = row.user_id || 'unknown';
      const role = row.users?.role || 'unknown';
      groupedByUser[uid] = (groupedByUser[uid] || 0) + 1;
      groupedByRole[role] = (groupedByRole[role] || 0) + 1;
    }

    res.json({
      total: (data || []).length,
      byRole: groupedByRole,
      byUser: groupedByUser,
      recent: data || [],
    });
  } catch (error) {
    console.error('Get notifications debug error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications debug data' });
  }
};

exports.getMyNotifications = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, research_id, type, title, message, is_read, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({ notifications: data || [] });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    if (error) throw error;

    res.json({ unreadCount: count || 0 });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select('id, is_read')
      .single();

    if (error) throw error;

    res.json({ message: 'Notification marked as read', notification: data });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    if (error) throw error;

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id); // users can only delete their own notifications

    if (error) throw error;

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};