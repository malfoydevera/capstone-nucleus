// Shared role display config (label + color tokens) for admin-facing user views.
// Mirrors the palette already used in pages/admin/UserManagement.jsx so role
// badges look consistent across the admin panel.
const ROLE_CONFIG = {
  admin: {
    label: 'Administrator',
    badgeClass: 'bg-red-50 text-red-700 border-red-100',
  },
  faculty: {
    label: 'Adviser',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  dean: {
    label: 'Dean',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-100',
  },
  program_chair: {
    label: 'Program Chair',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-100',
  },
  staff: {
    label: 'Research Editor',
    badgeClass: 'bg-[#3674B5]/10 text-[#3674B5] border-[#3674B5]/20',
  },
  student: {
    label: 'Student',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-100',
  },
};

const DEFAULT_ROLE_CONFIG = {
  label: 'User',
  badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const getRoleConfig = (role) => ROLE_CONFIG[role] || DEFAULT_ROLE_CONFIG;

export const ALL_ROLES = Object.keys(ROLE_CONFIG);
