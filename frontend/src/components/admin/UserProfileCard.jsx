import { Building2, GraduationCap, CalendarDays } from 'lucide-react';
import { formatFullName, getInitials } from '../../utils/names';
import { getRoleConfig } from '../../utils/roleConfig';

const formatJoinedDate = (value) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Compact scannable profile card used on the admin User Data page.
 * Shows the essentials an admin needs at a glance: identity, org placement,
 * account status, program ("course") enrollment, and join date.
 */
const UserProfileCard = ({ user, onOpen }) => {
  const roleConfig = getRoleConfig(user.role);
  const isActive = user.is_active !== false;
  const fullName = formatFullName(user) || 'Unnamed user';

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(user);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(user)}
      onKeyDown={handleKeyDown}
      aria-label={`View profile and records for ${fullName}`}
      className="group flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg hover:border-[#3674B5]/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#3674B5]/20 transition-all duration-200 cursor-pointer p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 shrink-0 rounded-full bg-[#3674B5]/10 flex items-center justify-center text-[#3674B5] font-bold text-base">
            {getInitials(user)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate" title={fullName}>{fullName}</p>
            <p className="text-xs text-slate-500 truncate" title={user.email}>{user.email}</p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden="true" />
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <span className={`self-start mb-3 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${roleConfig.badgeClass}`}>
        {roleConfig.label}
      </span>

      <div className="mt-auto space-y-2 text-xs text-slate-600 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
          <span className="truncate">{user.department || 'No department assigned'}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <GraduationCap size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
          <span className="truncate">{user.program || 'No course/program assigned'}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
          <span>Joined {formatJoinedDate(user.created_at || user.createdAt)}</span>
        </div>
      </div>
    </div>
  );
};

export default UserProfileCard;
