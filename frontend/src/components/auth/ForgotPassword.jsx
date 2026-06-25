import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../../utils/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugResetLink, setDebugResetLink] = useState('');
  const [deliveryHint, setDeliveryHint] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setDebugResetLink('');
    setDeliveryHint('');

    try {
      const response = await authAPI.forgotPassword({ email });
      const resetLink = response?.data?.resetLink;
      const delivery = response?.data?.emailDelivery;

      if (resetLink) {
        setDebugResetLink(resetLink);
      }

      if (delivery && !delivery.delivered) {
        setDeliveryHint(`Email not delivered: ${delivery.reason || 'Unknown reason'}`);
      }

      toast.success('If the email exists, a password reset link has been generated.');
    } catch (error) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        'Failed to process request';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </button>

        <h1 className="text-2xl font-bold text-slate-900">Forgot your password?</h1>
        <p className="text-slate-600 mt-2 mb-6">
          Enter your email and we will generate a reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#3674B5] text-white rounded-lg font-semibold hover:bg-[#2d6299] disabled:opacity-50"
          >
            {loading ? 'Generating link...' : 'Send reset link'}
          </button>
        </form>

        {debugResetLink && (
          <div className="mt-6 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-sm text-amber-800 font-medium">Development reset link:</p>
            <a
              href={debugResetLink}
              className="text-sm text-[#3674B5] underline break-all"
            >
              {debugResetLink}
            </a>
          </div>
        )}

        {deliveryHint && (
          <div className="mt-4 p-3 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-700">
            {deliveryHint}
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
