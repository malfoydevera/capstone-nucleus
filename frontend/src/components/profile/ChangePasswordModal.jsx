import { useState } from 'react';
import { Eye, EyeOff, Lock, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../../utils/api';
import { validatePasswordStrength } from '../../utils/passwordPolicy';

const emptyForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const ChangePasswordModal = ({ onClose }) => {
  const [form, setForm] = useState(emptyForm);
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [loading, setLoading] = useState(false);

  const setField = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const toggle = (field) => () =>
    setShow((prev) => ({ ...prev, [field]: !prev[field] }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.currentPassword) {
      toast.error('Please enter your current password');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    const strength = validatePasswordStrength(form.newPassword);
    if (!strength.valid) {
      toast.error(strength.message);
      return;
    }
    if (form.currentPassword === form.newPassword) {
      toast.error('New password must be different from your current password');
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password changed successfully');
      onClose();
    } catch (error) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        'Failed to change password';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: 'currentPassword', label: 'Current password', toggleKey: 'current', placeholder: 'Enter current password' },
    { key: 'newPassword', label: 'New password', toggleKey: 'next', placeholder: 'At least 8 characters, a letter and a number' },
    { key: 'confirmPassword', label: 'Confirm new password', toggleKey: 'confirm', placeholder: 'Re-enter new password' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close change password"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-fadeIn">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-[#3674B5]/5 to-transparent">
          <div className="flex items-center gap-2">
            <span className="h-9 w-9 rounded-lg bg-[#3674B5]/10 text-[#3674B5] inline-flex items-center justify-center">
              <Lock size={16} />
            </span>
            <div>
              <h3 className="font-semibold text-slate-900">Change password</h3>
              <p className="text-xs text-slate-500 mt-0.5">Update the password you use to sign in</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 inline-flex items-center justify-center"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {fields.map((field) => (
            <div key={field.key}>
              <label htmlFor={`cp-${field.key}`} className="block text-xs font-semibold text-slate-600 mb-1">
                {field.label}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  id={`cp-${field.key}`}
                  type={show[field.toggleKey] ? 'text' : 'password'}
                  required
                  value={form[field.key]}
                  onChange={setField(field.key)}
                  placeholder={field.placeholder}
                  autoComplete={field.key === 'currentPassword' ? 'current-password' : 'new-password'}
                  className="w-full h-11 pl-9 pr-10 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30"
                />
                <button
                  type="button"
                  onClick={toggle(field.toggleKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                  aria-label={show[field.toggleKey] ? 'Hide password' : 'Show password'}
                >
                  {show[field.toggleKey] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          ))}

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 rounded-xl bg-[#3674B5] text-white text-sm font-semibold hover:bg-[#2d6299] disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Change password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
