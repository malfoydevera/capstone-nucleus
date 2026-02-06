import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  BookOpen, 
  UserPlus, 
  Mail, 
  User, 
  Lock, 
  Eye, 
  EyeOff,
  GraduationCap,
  ArrowRight,
  Shield,
  Users,
  Briefcase,
  FileText
} from 'lucide-react';
import nuBuildingImg from '../../assets/nu-building.png';

const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    role: 'student',
    program: 'BSIT', // CHANGE 1: Initialize program with default
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match', {
        icon: '🔒',
      });
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters', {
        icon: '⚠️',
      });
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading('Creating your account...');

    // CHANGE 2: Pass program to register function
    const result = await register(
      formData.email,
      formData.password,
      formData.fullName,
      formData.role,
      formData.program 
    );

    setLoading(false);

    if (result.success) {
      toast.success('Account created successfully! Welcome! 🎉', {
        id: loadingToast,
        duration: 3000,
      });
      navigate('/dashboard');
    } else {
      toast.error(result.error || 'Failed to create account', {
        id: loadingToast,
        duration: 4000,
      });
      setError(result.error);
    }
  };

  const roleOptions = [
    { value: 'student', label: 'Student Researcher', icon: <GraduationCap size={16} /> },
    { value: 'faculty', label: 'Faculty Member', icon: <Users size={16} /> },
    { value: 'staff', label: 'Staff/Admin', icon: <Briefcase size={16} /> },
  ];

  const passwordStrength = formData.password.length > 0 ? 
    Math.min(Math.floor(formData.password.length / 2) * 20, 100) : 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 font-sans">
      {/* Background Image with Overlay - Smooth fade in */}
      <div className="fixed inset-0 z-0 animate-fadeIn">
        <img 
          src={nuBuildingImg} 
          alt="NU Building Background" 
          className="w-full h-full object-cover transition-transform duration-10000 ease-linear"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-900/60" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-12">
        <div className="flex flex-col lg:flex-row items-center justify-center gap-12">
          {/* Left Side - Branding and Info */}
          <div className="w-full lg:w-1/2 text-white space-y-8 animate-slideInLeft">
            <Link to="/" className="flex items-center gap-3 mb-8 group hover:opacity-90 transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-indigo-500/25 transition-all duration-300 group-hover:scale-105">
                <BookOpen size={24} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-2xl tracking-tight">ResearchHub</span>
                <span className="text-sm text-white/70 font-medium">NU Dasmariñas</span>
              </div>
            </Link>

            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-semibold tracking-wide backdrop-blur-md transition-all duration-300 hover:bg-white/15">
                <UserPlus size={16} className="text-indigo-300" />
                Join Academic Community
              </div>
              
              <h1 className="text-5xl md:text-6xl font-black leading-tight animate-fadeIn">
                Begin Your <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-blue-300 to-indigo-300">
                  Research Journey
                </span>
              </h1>
              
              <p className="text-lg text-slate-200 max-w-md leading-relaxed font-medium">
                Create your academic profile to access research tools, collaborate with peers, 
                and contribute to National University Dasmariñas' digital repository.
              </p>
            </div>

            {/* Benefits List */}
            <div className="space-y-4 mt-8">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:translate-x-1">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <FileText size={16} className="text-indigo-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Research Portfolio</div>
                  <div className="text-xs text-slate-300">Build your academic profile</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:translate-x-1">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Users size={16} className="text-blue-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Academic Network</div>
                  <div className="text-xs text-slate-300">Connect with researchers</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:translate-x-1">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Shield size={16} className="text-green-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Verified Access</div>
                  <div className="text-xs text-slate-300">Institutional verification</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Registration Form */}
          <div className="w-full lg:w-1/2 animate-slideInRight">
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 md:p-12 shadow-2xl border border-white/20 transition-all duration-500 hover:shadow-3xl">
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg transition-all duration-300 hover:scale-105">
                  <UserPlus size={28} className="text-white" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">
                  Create Academic Account
                </h2>
                <p className="text-slate-600 font-medium">
                  Join the ResearchHub community
                </p>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3.5 rounded-xl text-sm font-medium flex items-center gap-2 animate-shake">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    {error}
                  </div>
                )}

                {/* Full Name Field */}
                <div className="space-y-2 transition-all duration-300">
                  <label htmlFor="fullName" className="block text-sm font-semibold text-slate-700">
                    <div className="flex items-center gap-2 mb-1">
                      <User size={16} className="text-indigo-600" />
                      Full Name
                    </div>
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 font-medium shadow-sm hover:border-slate-300"
                    placeholder="Enter your full name"
                  />
                </div>

                {/* Email Field */}
                <div className="space-y-2 transition-all duration-300">
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail size={16} className="text-indigo-600" />
                      Institutional Email
                    </div>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 font-medium shadow-sm hover:border-slate-300"
                    placeholder="student@national-u.edu.ph"
                  />
                  <p className="text-xs text-slate-500 mt-1 transition-all duration-300">
                    Use your institutional email address for verification
                  </p>
                </div>

                {/* Role Selection */}
                <div className="space-y-2 transition-all duration-300">
                  <label htmlFor="role" className="block text-sm font-semibold text-slate-700">
                    <div className="flex items-center gap-2 mb-1">
                      <Briefcase size={16} className="text-indigo-600" />
                      Academic Role
                    </div>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {roleOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleChange({ target: { name: 'role', value: option.value } })}
                        className={`p-3 rounded-lg border-2 transition-all duration-300 flex flex-col items-center gap-2 ${
                          formData.role === option.value
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-25'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${
                          formData.role === option.value
                            ? 'bg-indigo-100 text-indigo-600'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {option.icon}
                        </div>
                        <span className="text-xs font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  <input
                    type="hidden"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                  />
                </div>

                {/* CHANGE 3: Program Selection (Visible only for Students) */}
                {formData.role === 'student' && (
                  <div className="space-y-2 animate-fadeIn transition-all duration-300">
                    <label className="block text-sm font-semibold text-slate-700">
                      <div className="flex items-center gap-2 mb-1">
                        <GraduationCap size={16} className="text-indigo-600" />
                        Program
                      </div>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className={`relative flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        formData.program === 'BSIT' 
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' 
                          : 'border-slate-200 hover:border-indigo-200'
                      }`}>
                        <input
                          type="radio"
                          name="program"
                          value="BSIT"
                          checked={formData.program === 'BSIT'}
                          onChange={handleChange}
                          className="absolute opacity-0"
                        />
                        <span className="font-bold">BSIT</span>
                      </label>
                      
                      <label className={`relative flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        formData.program === 'BSCS' 
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' 
                          : 'border-slate-200 hover:border-indigo-200'
                      }`}>
                        <input
                          type="radio"
                          name="program"
                          value="BSCS"
                          checked={formData.program === 'BSCS'}
                          onChange={handleChange}
                          className="absolute opacity-0"
                        />
                        <span className="font-bold">BSCS</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Password Field */}
                <div className="space-y-3 transition-all duration-300">
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                    <div className="flex items-center gap-2 mb-1">
                      <Lock size={16} className="text-indigo-600" />
                      Password
                    </div>
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 font-medium shadow-sm hover:border-slate-300 pr-12"
                      placeholder="Create a strong password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-all duration-300"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  
                  {/* Password Strength Indicator */}
                  {formData.password.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-600">Password strength</span>
                        <span className={`font-semibold ${
                          passwordStrength < 50 ? 'text-red-500' :
                          passwordStrength < 80 ? 'text-yellow-500' : 'text-green-500'
                        }`}>
                          {passwordStrength < 50 ? 'Weak' :
                           passwordStrength < 80 ? 'Good' : 'Strong'}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ease-out ${
                            passwordStrength < 50 ? 'bg-red-500' :
                            passwordStrength < 80 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${passwordStrength}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-2 transition-all duration-300">
                  <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-700">
                    <div className="flex items-center gap-2 mb-1">
                      <Lock size={16} className="text-indigo-600" />
                      Confirm Password
                    </div>
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className={`w-full px-4 py-3.5 bg-white border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 font-medium shadow-sm pr-12 ${
                        formData.confirmPassword && formData.password !== formData.confirmPassword
                          ? 'border-red-300 hover:border-red-400'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      placeholder="Re-enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-all duration-300"
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-red-500 text-xs font-medium animate-fadeIn">
                      Passwords do not match
                    </p>
                  )}
                </div>

                {/* Terms Agreement */}
                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl transition-all duration-300">
                  <input
                    type="checkbox"
                    id="terms"
                    required
                    className="mt-1 w-4 h-4 text-indigo-600 bg-white border-slate-300 rounded focus:ring-indigo-500 focus:ring-2 transition-all duration-300"
                  />
                  <label htmlFor="terms" className="text-sm text-slate-600">
                    I agree to the <a href="#" className="text-indigo-600 hover:text-indigo-500 font-medium transition-colors">Terms of Service</a> and acknowledge that my academic work will be subject to institutional review and verification.
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
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Create Academic Account
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="relative transition-all duration-300">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-slate-500 font-medium">Already a member?</span>
                  </div>
                </div>

                {/* Login Link */}
                <div className="text-center transition-all duration-300">
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="w-full py-3 px-6 bg-white border-2 border-indigo-200 text-indigo-700 rounded-xl font-bold text-base hover:bg-indigo-50 transition-all duration-300 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                  >
                    Sign In to Existing Account
                  </button>
                </div>
              </form>

              {/* Footer Note */}
              <div className="mt-10 pt-6 border-t border-slate-100 transition-all duration-300">
                <div className="flex items-center justify-center gap-2">
                  <Shield size={14} className="text-green-500 animate-pulse-slow" />
                  <p className="text-xs text-slate-500 text-center">
                    All accounts require institutional verification within 24-48 hours
                  </p>
                </div>
                <p className="text-xs text-slate-400 text-center mt-2">
                  © {new Date().getFullYear()} National University Dasmariñas
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;