import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  BookOpen, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff,
  GraduationCap,
  ArrowRight,
  Shield,
  Key,
  LogIn
} from 'lucide-react';
import nuBuildingImg from '../../assets/nu-building.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState({
    email: false,
    password: false
  });
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const loadingToast = toast.loading('Signing in...');
    const result = await login(email, password);
    
    setLoading(false);
    
    if (result.success) {
      toast.success('Welcome back! 👋', {
        id: loadingToast,
        duration: 2000,
      });
      navigate('/dashboard');
    } else {
      toast.error(result.error || 'Failed to sign in', {
        id: loadingToast,
        duration: 4000,
      });
      setError(result.error);
    }
  };

  const handleFocus = (field) => {
    setIsFocused(prev => ({ ...prev, [field]: true }));
  };

  const handleBlur = (field) => {
    setIsFocused(prev => ({ ...prev, [field]: false }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 font-sans overflow-hidden">
      {/* Background Image with Overlay - Smooth parallax effect */}
      <div className="fixed inset-0 z-0 animate-fadeIn">
        <img 
          src={nuBuildingImg} 
          alt="NU Building Background" 
          className="w-full h-full object-cover transition-transform duration-30000 ease-linear transform hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-900/60 transition-all duration-1000" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
      </div>

      {/* Floating particles for depth */}
      <div className="absolute inset-0 z-1 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/10 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${10 + Math.random() * 10}s`
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-12">
        <div className="flex flex-col lg:flex-row items-center justify-center gap-12">
          {/* Left Side - Branding and Info */}
          <div className="w-full lg:w-1/2 text-white space-y-8 animate-slideInLeft">
            <Link 
              to="/" 
              className="flex items-center gap-3 mb-8 group hover:opacity-90 transition-all duration-500"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-indigo-500/25 transition-all duration-500 group-hover:scale-105 group-hover:rotate-3">
                <BookOpen size={24} className="text-white transition-transform duration-500 group-hover:scale-110" />
              </div>
              <div className="flex flex-col transform transition-all duration-500 group-hover:translate-x-1">
                <span className="font-bold text-2xl tracking-tight">ResearchHub</span>
                <span className="text-sm text-white/70 font-medium">NU Dasmariñas</span>
              </div>
            </Link>

            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-semibold tracking-wide backdrop-blur-md transition-all duration-500 hover:bg-white/15 hover:scale-105 transform">
                <GraduationCap size={16} className="text-indigo-300 transition-transform duration-500 hover:rotate-12" />
                Academic Portal Access
              </div>
              
              <h1 className="text-5xl md:text-6xl font-black leading-tight animate-fadeIn">
                Welcome Back, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-blue-300 to-indigo-300 animate-gradient">
                  Scholar
                </span>
              </h1>
              
              <p className="text-lg text-slate-200 max-w-md leading-relaxed font-medium transition-all duration-500 hover:text-slate-100">
                Access your research dashboard, collaborate with peers, and contribute to the academic repository of National University Dasmariñas.
              </p>
            </div>

            {/* Features List with Hover Effects */}
            <div className="grid grid-cols-2 gap-4 mt-8">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm transition-all duration-500 hover:bg-white/10 hover:translate-x-1 hover:shadow-lg group">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:bg-indigo-500/30">
                  <Shield size={18} className="text-indigo-400 transition-transform duration-500 group-hover:rotate-12" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white transition-all duration-500 group-hover:text-indigo-200">Secure Access</div>
                  <div className="text-xs text-slate-300">Enterprise-grade security</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm transition-all duration-500 hover:bg-white/10 hover:translate-x-1 hover:shadow-lg group">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:bg-blue-500/30">
                  <Key size={18} className="text-blue-400 transition-transform duration-500 group-hover:rotate-12" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white transition-all duration-500 group-hover:text-blue-200">Research Tools</div>
                  <div className="text-xs text-slate-300">Advanced analytics</div>
                </div>
              </div>
            </div>

            {/* Stats with Counter Animation */}
            <div className="mt-12 grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 transition-all duration-500 hover:bg-white/10 hover:scale-105">
                <div className="text-2xl font-bold text-white mb-1 animate-count">500+</div>
                <div className="text-xs text-slate-300">Research Papers</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 transition-all duration-500 hover:bg-white/10 hover:scale-105">
                <div className="text-2xl font-bold text-white mb-1 animate-count">1K+</div>
                <div className="text-xs text-slate-300">Active Scholars</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 transition-all duration-500 hover:bg-white/10 hover:scale-105">
                <div className="text-2xl font-bold text-white mb-1 animate-count">24/7</div>
                <div className="text-xs text-slate-300">Access</div>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="w-full lg:w-1/2 animate-slideInRight">
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 md:p-12 shadow-2xl border border-white/20 transition-all duration-700 hover:shadow-3xl transform hover:-translate-y-1">
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg transition-all duration-500 hover:scale-110 hover:rotate-3">
                  <LogIn size={28} className="text-white transition-transform duration-500 hover:scale-110" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2 transition-all duration-500 hover:text-indigo-700">
                  Sign In to ResearchHub
                </h2>
                <p className="text-slate-600 font-medium transition-all duration-500 hover:text-slate-700">
                  Enter your institutional credentials
                </p>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3.5 rounded-xl text-sm font-medium flex items-center gap-2 animate-shake">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    {error}
                  </div>
                )}

                {/* Email Field */}
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700 transition-all duration-300">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail size={16} className={`transition-all duration-300 ${isFocused.email ? 'text-indigo-600 scale-110' : 'text-indigo-600'}`} />
                      Email Address
                    </div>
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => handleFocus('email')}
                      onBlur={() => handleBlur('email')}
                      className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-500 font-medium shadow-sm hover:border-slate-300 transform hover:-translate-y-0.5"
                      placeholder="student@national-u.edu.ph"
                    />
                    {isFocused.email && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transform origin-left transition-all duration-500 scale-x-100"></div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 transition-all duration-300">
                    Use your institutional email address
                  </p>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-700 transition-all duration-300">
                    <div className="flex items-center gap-2 mb-1">
                      <Lock size={16} className={`transition-all duration-300 ${isFocused.password ? 'text-indigo-600 scale-110' : 'text-indigo-600'}`} />
                      Password
                    </div>
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => handleFocus('password')}
                      onBlur={() => handleBlur('password')}
                      className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-500 font-medium shadow-sm hover:border-slate-300 transform hover:-translate-y-0.5 pr-12"
                      placeholder="Enter your password"
                    />
                    {isFocused.password && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transform origin-left transition-all duration-500 scale-x-100"></div>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-all duration-300 hover:scale-110"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <div className="flex justify-between items-center transition-all duration-300">
                    <p className="text-xs text-slate-500">
                      Must be at least 8 characters
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-all duration-300 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl transition-all duration-300 hover:bg-slate-100">
                  <input
                    type="checkbox"
                    id="remember"
                    className="w-4 h-4 text-indigo-600 bg-white border-slate-300 rounded focus:ring-indigo-500 focus:ring-2 transition-all duration-300 hover:scale-110"
                  />
                  <label htmlFor="remember" className="text-sm text-slate-600 transition-all duration-300">
                    Keep me signed in on this device
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-bold text-base hover:from-indigo-700 hover:to-blue-700 transition-all duration-500 shadow-lg hover:shadow-xl hover:shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 disabled:hover:transform-none flex items-center justify-center gap-3 group animate-pulse-subtle"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <span className="transition-all duration-300 group-hover:tracking-wider">Sign In</span>
                      <ArrowRight size={18} className="transition-all duration-300 group-hover:translate-x-2 group-hover:scale-110" />
                    </>
                  )}
                </button>

                {/* Divider with Animation */}
                <div className="relative transition-all duration-500">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 transition-all duration-500 hover:border-indigo-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-slate-500 font-medium transition-all duration-500 hover:text-slate-700">
                      New to ResearchHub?
                    </span>
                  </div>
                </div>

                {/* Register Link */}
                <div className="text-center transition-all duration-500">
                  <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="w-full py-3 px-6 bg-white border-2 border-indigo-200 text-indigo-700 rounded-xl font-bold text-base hover:bg-indigo-50 transition-all duration-500 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 hover:border-indigo-300 flex items-center justify-center gap-2 group"
                  >
                    <span className="transition-all duration-300 group-hover:tracking-wider">
                      Create Academic Account
                    </span>
                    <ArrowRight size={16} className="transition-all duration-300 group-hover:translate-x-1" />
                  </button>
                  <p className="text-slate-500 text-sm mt-4 transition-all duration-500 hover:text-slate-600">
                    For faculty registration, contact your department administrator
                  </p>
                </div>
              </form>

              {/* Footer Note with Pulse */}
              <div className="mt-10 pt-6 border-t border-slate-100 transition-all duration-500 hover:border-slate-200">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Shield size={14} className="text-green-500 animate-pulse-slow transition-all duration-500 hover:scale-125" />
                  <p className="text-xs text-slate-500 text-center transition-all duration-500 hover:text-slate-600">
                    This system is protected by institutional security protocols
                  </p>
                </div>
                <div className="flex items-center justify-center gap-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse animation-delay-200"></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse animation-delay-400"></div>
                </div>
                <p className="text-xs text-slate-400 text-center mt-4 transition-all duration-500 hover:text-slate-500">
                  © {new Date().getFullYear()} National University Dasmariñas
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification (Hidden by default) */}
      {loading && (
        <div className="fixed top-4 right-4 z-50 animate-slideInRight">
          <div className="bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 transform transition-all duration-500 hover:scale-105">
            <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
            <span className="font-medium">Authenticating...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;