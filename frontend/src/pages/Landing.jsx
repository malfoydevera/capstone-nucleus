import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import nuBuildingImg from '../assets/nu-building.png';

import { 
  BookOpen, 
  Search, 
  ShieldCheck, 
  ArrowRight, 
  FileText, 
  Zap,
  CheckCircle2,
  GraduationCap,
  Users,
  BarChart3,
  Library,
  Globe,
  Shield
} from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const authAction = user ? (
    <button 
      onClick={() => navigate('/dashboard')}
      className="bg-indigo-700 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-800 transition-all shadow-md font-semibold hover:shadow-lg transform hover:-translate-y-0.5"
    >
      Go to Dashboard
    </button>
  ) : (
    <div className="flex items-center gap-4">
      <Link to="/login" className="text-white/95 hover:text-white font-medium transition-colors px-4 py-2 rounded-lg hover:bg-white/10">
        Sign In
      </Link>
      <Link to="/register" className="bg-white text-indigo-700 px-6 py-2.5 rounded-lg hover:bg-indigo-50 transition-all shadow-md font-semibold hover:shadow-lg transform hover:-translate-y-0.5">
        Get Started
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white font-sans text-slate-900 antialiased">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 md:px-16 py-6 absolute top-0 w-full z-50 bg-gradient-to-b from-slate-900/90 to-transparent backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-700 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <Library size={24} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xl tracking-tight text-white">
              ResearchHub
            </span>
            <span className="text-xs text-white/70 font-medium">NU Dasmariñas</span>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-white/90 hover:text-white transition-colors hover:underline decoration-indigo-400 decoration-2 underline-offset-4">Features</a>
          <a href="#stats" className="text-sm font-medium text-white/90 hover:text-white transition-colors hover:underline decoration-indigo-400 decoration-2 underline-offset-4">Impact</a>
          <div className="h-6 w-px bg-white/20 mx-2"></div>
          {authAction}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-24 pb-20 overflow-hidden">
        {/* Background Image with Enhanced Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src={nuBuildingImg} 
            alt="NU Building Background" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/85 to-slate-900/70" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-16 relative z-10 w-full">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-semibold mb-8 tracking-wide backdrop-blur-md">
              <GraduationCap size={16} className="text-indigo-300" />
              National University Dasmariñas • Academic Repository
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tight mb-6 leading-[1.1]">
              Preserving Knowledge, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-blue-300 to-indigo-300">
                Empowering Innovation
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-200 max-w-2xl mb-10 leading-relaxed font-medium">
              A centralized digital ecosystem for academic excellence. Explore, submit, and discover 
              verified research works from the National University Dasmariñas community.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-5 mb-16">
              <button 
                onClick={() => navigate(user ? '/dashboard' : '/register')}
                className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-bold text-base hover:from-indigo-700 hover:to-blue-700 transition-all shadow-xl hover:shadow-2xl hover:shadow-indigo-900/30 flex items-center justify-center gap-3 group transform hover:-translate-y-0.5"
              >
                <BookOpen size={20} />
                Explore Repository
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              
              <div className="flex items-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/15 backdrop-blur-md">
                <Shield size={18} className="text-indigo-400" />
                <span className="text-white/95 font-semibold text-sm">Institutional Verification</span>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
              <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10">
                <div className="text-2xl font-bold text-white mb-1">500+</div>
                <div className="text-sm text-slate-300">Research Papers</div>
              </div>
              <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10">
                <div className="text-2xl font-bold text-white mb-1">100+</div>
                <div className="text-sm text-slate-300">Faculty</div>
              </div>
              <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10">
                <div className="text-2xl font-bold text-white mb-1">10K+</div>
                <div className="text-sm text-slate-300">Monthly Views</div>
              </div>
              <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10">
                <div className="text-2xl font-bold text-white mb-1">50+</div>
                <div className="text-sm text-slate-300">Departments</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gradient-to-b from-white to-slate-50 relative">
        <div className="max-w-7xl mx-auto px-6 md:px-16">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Academic Excellence, <span className="text-indigo-700">Digitized</span>
            </h2>
            <p className="text-lg text-slate-600 font-medium">
              A comprehensive platform designed to support the entire research lifecycle 
              at National University Dasmariñas
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-20">
            <FeatureCard 
              icon={<Search className="text-indigo-600" size={24} />}
              title="Intelligent Discovery"
              desc="Advanced search algorithms and filters to navigate decades of institutional knowledge with precision."
              gradient="from-indigo-50 to-blue-50"
            />
            <FeatureCard 
              icon={<ShieldCheck className="text-indigo-600" size={24} />}
              title="Secure Preservation"
              desc="Bank-level security for archival with version control and digital rights management."
              gradient="from-indigo-50 to-purple-50"
            />
            <FeatureCard 
              icon={<FileText className="text-indigo-600" size={24} />}
              title="Collaborative Workflow"
              desc="Streamlined submission, review, and approval processes for academic teams."
              gradient="from-blue-50 to-indigo-50"
            />
          </div>

          {/* Additional Features */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h3 className="text-3xl font-bold text-slate-900">
                Trusted by Academic Community
              </h3>
              <p className="text-slate-600 text-lg leading-relaxed">
                ResearchHub serves as the official digital repository for National University Dasmariñas, 
                ensuring academic integrity and long-term preservation of scholarly works.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-green-500" size={20} />
                  <span className="font-medium text-slate-700">Faculty-verified content</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-green-500" size={20} />
                  <span className="font-medium text-slate-700">Plagiarism detection integrated</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-green-500" size={20} />
                  <span className="font-medium text-slate-700">Citation generation tools</span>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl p-8 border border-slate-200 shadow-lg">
              <div className="aspect-video bg-gradient-to-br from-indigo-100 to-blue-100 rounded-xl mb-6 flex items-center justify-center">
                <div className="text-center p-8">
                  <Users size={48} className="text-indigo-600 mx-auto mb-4" />
                  <div className="text-2xl font-bold text-indigo-700">1,000+ Active Scholars</div>
                  <div className="text-slate-600">Engaged in research activities</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section id="stats" className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 md:px-16">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Research Impact <span className="text-indigo-300">Visualized</span>
            </h2>
            <p className="text-lg text-slate-300 font-medium">
              Tracking academic contributions and knowledge dissemination
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <ImpactStat 
              value="98%"
              label="Content Accuracy"
              description="Verified by faculty reviewers"
              icon={<CheckCircle2 size={20} />}
            />
            <ImpactStat 
              value="24/7"
              label="Accessibility"
              description="Global access to repository"
              icon={<Globe size={20} />}
            />
            <ImpactStat 
              value="75%"
              label="Adoption Rate"
              description="Among academic departments"
              icon={<Users size={20} />}
            />
            <ImpactStat 
              value="4.8★"
              label="Satisfaction"
              description="From student researchers"
              icon={<BarChart3 size={20} />}
            />
          </div>
        </div>
      </section>

      {/* CTA Section - Fixed SVG background */}
      <section className="py-20 bg-gradient-to-r from-indigo-700 to-blue-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px'
          }}></div>
        </div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Join the Academic Conversation
          </h2>
          <p className="text-xl text-indigo-100 mb-10 max-w-2xl mx-auto">
            Contribute to the growing body of knowledge at National University Dasmariñas
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => navigate(user ? '/dashboard' : '/register')}
              className="px-8 py-3.5 bg-white text-indigo-700 rounded-xl font-bold text-lg hover:bg-indigo-50 transition-all shadow-2xl transform hover:-translate-y-0.5 flex items-center justify-center gap-3 mx-auto"
            >
              Start Your Research Journey
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-12 px-6 border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-lg flex items-center justify-center">
                <Library size={20} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl text-white">ResearchHub</span>
                <span className="text-sm text-slate-400">NU Dasmariñas</span>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-6">
              <a href="#" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">About</a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Contact</a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Privacy</a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Terms</a>
            </div>
          </div>
          <div className="text-center pt-8 border-t border-slate-800">
            <p className="text-slate-500 text-sm font-medium">
              © {new Date().getFullYear()} National University Dasmariñas Research Repository. 
              All rights reserved.
            </p>
            <p className="text-slate-600 text-xs mt-2">
              Dedicated to academic excellence and knowledge preservation
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc, gradient }) => (
  <div className={`bg-gradient-to-b ${gradient} p-8 rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-100/30 transition-all duration-300 group transform hover:-translate-y-1`}>
    <div className="w-16 h-16 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center mb-6 group-hover:shadow-md transition-shadow">
      {icon}
    </div>
    <h3 className="text-2xl font-bold text-slate-900 mb-4 tracking-tight">{title}</h3>
    <p className="text-slate-600 leading-relaxed font-medium">{desc}</p>
  </div>
);

const ImpactStat = ({ value, label, description, icon }) => (
  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 border border-slate-700 hover:border-indigo-500 transition-all group">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300">
        {icon}
      </div>
      <div className="text-4xl font-bold text-white group-hover:text-indigo-300 transition-colors">
        {value}
      </div>
    </div>
    <h4 className="text-lg font-semibold text-white mb-2">{label}</h4>
    <p className="text-slate-400 text-sm">{description}</p>
  </div>
);

export default Landing;