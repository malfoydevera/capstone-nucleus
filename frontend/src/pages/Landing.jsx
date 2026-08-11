import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import nuBuildingImg from '../assets/dasma.webp';
import nuLogoLeft from '../assets/left.png';

import NucleusLogoMark from '../components/branding/NucleusLogoMark';
import usePublicStats, { formatStatNumber } from '../hooks/usePublicStats';
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
  Globe,
  Shield,
  MapPin,
  Phone,
  Mail,
  Clock,
  Quote,
  ChevronLeft,
  ChevronRight,
  Star,
  Menu,
  X,
} from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [navScrolled, setNavScrolled] = useState(false);
  const { researchPapers, activeScholars, loading: statsLoading } = usePublicStats();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [mobileMenuOpen]);

  const authAction = user ? (
    <button 
      onClick={() => navigate('/dashboard')}
      className="bg-[#1C4D8D] hover:bg-[#163a6b] text-white px-6 py-2.5 rounded-lg transition-all shadow-md font-semibold hover:shadow-lg transform hover:-translate-y-0.5"
    >
      Go to Dashboard
    </button>
  ) : (
    <div className="flex items-center gap-4">
      <Link to="/login" className="text-white/95 hover:text-white font-medium transition-colors px-4 py-2 rounded-lg hover:bg-white/10">
        Sign In
      </Link>
      <Link to="/register" className="bg-[#1C4D8D] hover:bg-[#163a6b] text-white px-6 py-2.5 rounded-lg transition-all shadow-md font-semibold hover:shadow-lg transform hover:-translate-y-0.5">
        Get Started
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-50 to-white font-sans text-slate-900 antialiased">
      {/* Navigation */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          navScrolled
            ? 'bg-white/95 backdrop-blur-md shadow-lg border-b border-slate-200'
            : 'bg-gradient-to-b from-slate-900/80 to-transparent backdrop-blur-sm'
        }`}
      >
        <div className={`flex items-center justify-between max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 transition-all duration-300 ${navScrolled ? 'py-3' : 'py-4 sm:py-5'}`}>
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <NucleusLogoMark
              size={navScrolled ? 36 : 44}
              rounded="rounded-xl"
              className="shadow-lg transition-all duration-300"
              ringClassName={navScrolled ? 'ring-1 ring-slate-200/80' : 'ring-1 ring-white/25'}
            />
            <div className="min-w-0 flex flex-col">
              <span className={`truncate font-bold tracking-tight transition-colors duration-300 ${navScrolled ? 'text-[#1C4D8D] text-base sm:text-lg' : 'text-white text-lg sm:text-xl'}`}>
                NUCLEUS
              </span>
              <span className={`truncate text-[11px] sm:text-xs font-medium transition-colors duration-300 ${navScrolled ? 'text-slate-500' : 'text-white/70'}`}>
                NU Dasmariñas
              </span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-8">
            <a
              href="#features"
              className={`text-sm font-medium transition-colors hover:underline decoration-[#1C4D8D] decoration-2 underline-offset-4 ${
                navScrolled ? 'text-slate-700 hover:text-[#1C4D8D]' : 'text-white/90 hover:text-white'
              }`}
            >
              Features
            </a>
            <a
              href="#stats"
              className={`text-sm font-medium transition-colors hover:underline decoration-[#1C4D8D] decoration-2 underline-offset-4 ${
                navScrolled ? 'text-slate-700 hover:text-[#1C4D8D]' : 'text-white/90 hover:text-white'
              }`}
            >
              Impact
            </a>
            <div className={`h-6 w-px mx-2 ${navScrolled ? 'bg-slate-300' : 'bg-white/20'}`}></div>
            {authAction}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-colors lg:hidden ${
              navScrolled
                ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                : 'border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/15'
            }`}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <AnimatePresence>
          {mobileMenuOpen ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden border-t border-white/10 bg-slate-900/95 backdrop-blur-md lg:hidden"
            >
              <div className="space-y-1 px-4 py-4 sm:px-6">
                <a
                  href="#features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-xl px-4 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
                >
                  Features
                </a>
                <a
                  href="#stats"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-xl px-4 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
                >
                  Impact
                </a>
                <div className="border-t border-white/10 pt-3">
                  {user ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate('/dashboard');
                      }}
                      className="w-full rounded-xl bg-[#1C4D8D] px-4 py-3 text-sm font-semibold text-white shadow-md"
                    >
                      Go to Dashboard
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Link
                        to="/register"
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full rounded-xl bg-[#1C4D8D] px-4 py-3 text-center text-sm font-semibold text-white shadow-md"
                      >
                        Get Started
                      </Link>
                      <Link
                        to="/login"
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full rounded-xl border border-white/20 px-4 py-3 text-center text-sm font-medium text-white/95"
                      >
                        Sign In
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="relative flex min-h-[100dvh] items-center overflow-hidden pt-24 pb-12 sm:pt-28 sm:pb-16 md:pb-20">
        {/* Background Image with Enhanced Overlay */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${nuBuildingImg})` }}
            initial={{ scale: 1.08, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f2e57]/90 via-[#1C4D8D]/75 to-[#1C4D8D]/45 sm:from-[#0f2e57]/85 sm:via-[#1C4D8D]/70 sm:to-[#1C4D8D]/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/25 to-transparent sm:from-slate-900/90 sm:via-slate-900/20" />
          <div className="absolute -top-32 -right-32 hidden h-96 w-96 rounded-full bg-yellow-300/10 blur-3xl sm:block" />
          <div className="absolute -bottom-32 -left-32 hidden h-96 w-96 rounded-full bg-[#2563eb]/20 blur-3xl sm:block" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-12">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-5 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-center text-[11px] font-semibold tracking-wide text-white backdrop-blur-md sm:mb-8 sm:justify-start sm:px-4 sm:py-2 sm:text-sm"
            >
              <GraduationCap size={16} className="shrink-0 text-yellow-300" />
              <span className="sm:hidden">NU Dasmariñas • Academic Repository</span>
              <span className="hidden sm:inline">National University Dasmariñas • Academic Repository</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-4 text-[2rem] font-black leading-[1.08] tracking-tight text-white sm:mb-6 sm:text-5xl md:text-6xl lg:text-7xl"
            >
              Preserving Knowledge,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-300">
                Empowering Innovation
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-8 max-w-2xl text-base font-medium leading-relaxed text-slate-200 sm:mb-10 sm:text-lg md:text-xl"
            >
              A centralized digital ecosystem for academic excellence. Explore, submit, and discover
              verified research works from the National University Dasmariñas community.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mb-10 flex flex-col gap-3 sm:mb-16 sm:flex-row sm:items-center sm:gap-4"
            >
              <button
                onClick={() => navigate(user ? '/dashboard' : '/register')}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#1C4D8D] px-6 py-3.5 text-base font-bold text-white shadow-xl transition-all hover:-translate-y-0.5 hover:bg-[#163a6b] hover:shadow-2xl hover:shadow-[#1C4D8D]/30 sm:w-auto sm:px-8 sm:py-4"
              >
                <BookOpen size={20} />
                {user ? 'Go to Dashboard' : 'Get Started'}
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>

              <a
                href="#features"
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/25 bg-white/10 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-md transition-all hover:bg-white/15 sm:w-auto sm:px-8 sm:py-4"
              >
                Learn More
              </a>
            </motion.div>

            {/* Stats Bar */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.55 }}
              className="grid max-w-3xl grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4"
            >
              {[
                { value: statsLoading ? '…' : formatStatNumber(researchPapers), label: 'Research Papers' },
                { value: '100+', label: 'Faculty' },
                { value: '10K+', label: 'Monthly Views' },
                { value: '50+', label: 'Departments' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/15 bg-white/8 p-3 backdrop-blur-md transition-colors hover:bg-white/12 sm:p-4"
                >
                  <div className="mb-0.5 text-xl font-black text-white sm:mb-1 sm:text-2xl md:text-3xl">{stat.value}</div>
                  <div className="text-xs font-medium text-slate-300 sm:text-sm">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-28 bg-white relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #1C4D8D 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-16 relative">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 lg:mb-20">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#1C4D8D]/10 text-[#1C4D8D] text-sm font-semibold mb-6">
              Why Choose NUCLEUS
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              Academic Excellence, <br className="hidden md:block" />
              <span className="text-[#1C4D8D]">Digitized</span>
            </h2>
            <p className="text-base sm:text-lg text-slate-500 leading-relaxed">
              A comprehensive platform designed to support the entire research lifecycle 
              at National University Dasmariñas
            </p>
          </div>

          <div className="mb-16 grid grid-cols-1 gap-4 lg:mb-24 lg:grid-cols-2 lg:gap-6 xl:grid-cols-3 xl:gap-8">
            <FeatureCard 
              icon={<Search className="text-[#1C4D8D]" size={26} />}
              title="Intelligent Discovery"
              desc="Advanced search algorithms and filters to navigate decades of institutional knowledge with precision."
              index={0}
              bento="featured"
            />
            <FeatureCard 
              icon={<ShieldCheck className="text-[#1C4D8D]" size={26} />}
              title="Secure Preservation"
              desc="Bank-level security for archival with version control and digital rights management."
              index={1}
            />
            <FeatureCard 
              icon={<FileText className="text-[#1C4D8D]" size={26} />}
              title="Collaborative Workflow"
              desc="Streamlined submission, review, and approval processes for academic teams."
              index={2}
            />
          </div>

          {/* Trust Section */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <span className="inline-block px-4 py-1.5 rounded-full bg-green-100 text-green-700 text-sm font-semibold mb-6">
                Trusted Platform
              </span>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight">
                Trusted by the Academic Community
              </h3>
              <p className="text-slate-500 text-lg leading-relaxed mb-8">
                NUCLEUS serves as the official digital repository for National University Dasmariñas, 
                ensuring academic integrity and long-term preservation of scholarly works.
              </p>
              <div className="space-y-5">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all duration-300 hover:shadow-md hover:border-slate-200">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="text-green-600" size={20} />
                  </div>
                  <span className="font-medium text-slate-700">Faculty-verified content with multi-tier review</span>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all duration-300 hover:shadow-md hover:border-slate-200">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="text-green-600" size={20} />
                  </div>
                  <span className="font-medium text-slate-700">AI-powered research assistant for insights</span>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all duration-300 hover:shadow-md hover:border-slate-200">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="text-green-600" size={20} />
                  </div>
                  <span className="font-medium text-slate-700">Secure document storage and management</span>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-[#1C4D8D]/20 to-blue-400/20 rounded-3xl blur-2xl opacity-60"></div>
                <div className="relative bg-gradient-to-br from-slate-50 to-white rounded-2xl p-10 border border-slate-200 shadow-xl">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1C4D8D] to-blue-600 flex items-center justify-center mx-auto mb-6 shadow-lg">
                      <Users size={36} className="text-white" />
                    </div>
                    <div className="text-5xl font-bold text-slate-900 mb-2 tabular-nums">
                      {statsLoading ? '…' : formatStatNumber(activeScholars)}
                    </div>
                    <div className="text-xl text-[#1C4D8D] font-semibold mb-2">Active Scholars</div>
                    <div className="text-slate-500">Registered student accounts on NUCLEUS</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-slate-100">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900 tabular-nums">
                        {statsLoading ? '…' : formatStatNumber(researchPapers)}
                      </div>
                      <div className="text-sm text-slate-500">Published Papers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900">50+</div>
                      <div className="text-sm text-slate-500">Departments</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section id="stats" className="py-28 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#1C4D8D]/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto px-6 md:px-16 relative">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-yellow-300 text-sm font-semibold mb-6 backdrop-blur-sm">
              Our Impact
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Research Impact <span className="text-yellow-400">Visualized</span>
            </h2>
            <p className="text-lg text-slate-400">
              Tracking academic contributions and knowledge dissemination across the institution
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <ImpactStat 
              value="98%"
              label="Content Accuracy"
              description="Verified by faculty reviewers"
              icon={<CheckCircle2 size={22} />}
            />
            <ImpactStat 
              value="24/7"
              label="Accessibility"
              description="Global access to repository"
              icon={<Globe size={22} />}
            />
            <ImpactStat 
              value="75%"
              label="Adoption Rate"
              description="Among academic departments"
              icon={<Users size={22} />}
            />
            <ImpactStat 
              value="4.8★"
              label="Satisfaction"
              description="From student researchers"
              icon={<BarChart3 size={22} />}
            />
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* Showcase Section */}
      <ShowcaseSection />

      {/* CTA Section */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-16">
          <div className="relative bg-gradient-to-br from-[#1C4D8D] via-[#2156a8] to-[#1C4D8D] rounded-3xl p-12 md:p-16 overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-yellow-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                backgroundSize: '32px 32px'
              }}></div>
            </div>
            
            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10">
              <div className="text-center lg:text-left max-w-xl">
                <span className="inline-block px-4 py-1.5 rounded-full bg-white/20 text-yellow-300 text-sm font-semibold mb-6 backdrop-blur-sm">
                  Ready to Get Started?
                </span>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
                  Share Your Research <br className="hidden md:block" />
                  With the World
                </h2>
                <p className="text-white/80 text-lg">
                  Join hundreds of students and faculty members contributing to the NU Dasmariñas research repository.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => navigate(user ? '/dashboard' : '/register')}
                  className="group px-8 py-4 bg-white hover:bg-yellow-300 text-[#1C4D8D] rounded-xl font-bold text-base transition-all duration-300 shadow-lg hover:shadow-2xl flex items-center justify-center gap-3"
                >
                  Get Started Now
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
                </button>
                <button 
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded-xl font-semibold text-base transition-all duration-300 backdrop-blur-sm"
                >
                  Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1C4D8D] py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 mb-8">
            {/* Left - Logo */}
            <div className="flex items-center gap-4">
              <img 
                src={nuLogoLeft} 
                alt="National University" 
                className="h-24 w-auto object-contain"
              />
            </div>

            {/* Center - About */}
            <div>
              <h3 className="text-white font-bold text-lg mb-4">ABOUT NUCLEUS</h3>
              <p className="text-white/80 text-sm leading-relaxed">
                NUCLEUS is the official research repository of National University Dasmariñas, 
                providing a centralized platform for submitting, managing, and discovering 
                academic research works from students and faculty.
              </p>
            </div>

            {/* Right - Contact */}
            <div>
              <h3 className="text-white font-bold text-lg mb-4">CONTACT US</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                  <span className="text-white/80 text-sm">
                    Governor's Drive, Sampaloc 1, City of Dasmariñas, Cavite 4114
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-yellow-400 flex-shrink-0" />
                  <span className="text-white/80 text-sm">
                    09399151561(Smart) / 09661381357(Globe)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-yellow-400 flex-shrink-0" />
                  <span className="text-white/80 text-sm">
                    admissions@nu-dasma.edu.ph
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-yellow-400 flex-shrink-0" />
                  <span className="text-white/80 text-sm">
                    Monday to Friday (8:30AM - 5:30PM); Saturday (8:30AM - 12:30PM)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/20 pt-6">
            <p className="text-center text-yellow-400 text-sm font-medium">
              All Rights Reserved. National University
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc, index, bento }) => (
  <div 
    className={`group relative flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-5 transition-all duration-300 hover:border-[#1C4D8D]/20 hover:shadow-xl hover:shadow-[#1C4D8D]/10 motion-reduce:transition-none xl:block xl:p-8 xl:hover:shadow-2xl ${
      bento === 'featured' ? 'lg:col-span-2 xl:col-span-1' : ''
    }`}
    style={{ animationDelay: `${index * 100}ms` }}
  >
    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#1C4D8D]/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none xl:duration-500" />
    <div className="relative flex min-w-0 flex-1 items-start gap-4 xl:block">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1C4D8D]/10 transition-all duration-300 group-hover:scale-105 group-hover:bg-[#1C4D8D] motion-reduce:transition-none xl:mb-6 xl:h-14 xl:w-14 xl:group-hover:scale-110">
        <div className="transition-colors duration-300 group-hover:text-white motion-reduce:transition-none [&>svg]:h-5 [&>svg]:w-5 xl:[&>svg]:h-[26px] xl:[&>svg]:w-[26px]">
          {icon}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="mb-1 text-base font-bold text-slate-900 transition-colors duration-300 group-hover:text-[#1C4D8D] motion-reduce:transition-none xl:mb-3 xl:text-xl">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-slate-500 xl:text-base">{desc}</p>
      </div>
    </div>
  </div>
);

const ImpactStat = ({ value, label, description, icon }) => (
  <div className="group relative bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-yellow-400/50 transition-all duration-500 hover:bg-white/10 overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    <div className="relative">
      <div className="flex items-center justify-between mb-6">
        <div className="p-3 rounded-xl bg-[#1C4D8D]/30 text-yellow-300 group-hover:bg-yellow-400 group-hover:text-slate-900 transition-all duration-300">
          {icon}
        </div>
      </div>
      <div className="text-4xl font-bold text-white mb-2 group-hover:text-yellow-300 transition-colors duration-300">
        {value}
      </div>
      <h4 className="text-lg font-semibold text-white mb-1">{label}</h4>
      <p className="text-slate-400 text-sm">{description}</p>
    </div>
  </div>
);

// Testimonials Data
const testimonials = [
  {
    id: 1,
    name: "Maria Santos",
    role: "BS Computer Science, 4th Year",
    content: "NUCLEUS made submitting my capstone research so much easier. The review process was transparent and the faculty feedback helped improve my paper significantly.",
    rating: 5,
    avatar: "MS"
  },
  {
    id: 2,
    name: "Juan Dela Cruz",
    role: "Faculty Adviser, College of Engineering",
    content: "As a faculty member, I appreciate how the platform streamlines the review workflow. I can easily track submissions and provide feedback to students efficiently.",
    rating: 5,
    avatar: "JD"
  },
  {
    id: 3,
    name: "Angela Reyes",
    role: "BS Information Technology, Graduate",
    content: "Being able to browse and cite previous research works from NU students helped me build a stronger foundation for my thesis. Highly recommended!",
    rating: 5,
    avatar: "AR"
  },
  {
    id: 4,
    name: "Dr. Roberto Mendoza",
    role: "Research Coordinator",
    content: "NUCLEUS has transformed how we manage academic research at NU Dasmariñas. The analytics and reporting features give us valuable insights into our research output.",
    rating: 5,
    avatar: "RM"
  }
];

// Showcase Data
const showcaseItems = [
  {
    id: 1,
    title: "AI-Powered Crop Disease Detection System",
    department: "College of Computer Studies",
    authors: "Santos, M., Garcia, L., Cruz, A.",
    year: "2025",
    category: "Machine Learning"
  },
  {
    id: 2,
    title: "Sustainable Waste Management App for Smart Cities",
    department: "College of Engineering",
    authors: "Reyes, J., Tan, R., Lopez, M.",
    year: "2025",
    category: "Mobile Development"
  },
  {
    id: 3,
    title: "Mental Health Support Platform for Students",
    department: "College of Arts and Sciences",
    authors: "Villanueva, C., Santos, P.",
    year: "2025",
    category: "Web Application"
  },
  {
    id: 4,
    title: "Blockchain-Based Academic Records System",
    department: "College of Computer Studies",
    authors: "Fernandez, K., Ramos, D., Lee, S.",
    year: "2024",
    category: "Blockchain"
  },
  {
    id: 5,
    title: "IoT-Enabled Campus Security Monitoring",
    department: "College of Engineering",
    authors: "Aquino, M., Torres, B.",
    year: "2024",
    category: "Internet of Things"
  }
];

// Testimonials Section Component
const TestimonialsSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const nextTestimonial = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      nextTestimonial();
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const variants = {
    enter: (direction) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };

  return (
    <section className="py-24 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-slate-900 to-transparent opacity-5"></div>
      
      <div className="max-w-7xl mx-auto px-6 md:px-16">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#1C4D8D]/10 text-[#1C4D8D] text-sm font-semibold mb-6">
            Testimonials
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
            What Our <span className="text-[#1C4D8D]">Community</span> Says
          </h2>
          <p className="text-lg text-slate-500">
            Hear from students and faculty who use NUCLEUS every day
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Decorative quote */}
          <div className="absolute -top-8 -left-4 md:-left-12 text-[#1C4D8D]/10">
            <Quote size={120} strokeWidth={1} />
          </div>

          {/* Testimonial Card */}
          <div className="relative bg-white rounded-3xl shadow-xl border border-slate-100 p-8 md:p-12 min-h-[320px] overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="flex flex-col items-center text-center"
              >
                {/* Avatar */}
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#1C4D8D] to-blue-600 flex items-center justify-center text-white text-2xl font-bold mb-6 shadow-lg">
                  {testimonials[currentIndex].avatar}
                </div>

                {/* Stars */}
                <div className="flex gap-1 mb-6">
                  {[...Array(testimonials[currentIndex].rating)].map((_, i) => (
                    <Star key={i} size={20} className="text-yellow-400 fill-yellow-400" />
                  ))}
                </div>

                {/* Content */}
                <p className="text-xl md:text-2xl text-slate-700 leading-relaxed mb-8 max-w-2xl">
                  "{testimonials[currentIndex].content}"
                </p>

                {/* Author */}
                <div>
                  <h4 className="text-lg font-bold text-slate-900">{testimonials[currentIndex].name}</h4>
                  <p className="text-[#1C4D8D] font-medium">{testimonials[currentIndex].role}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-center items-center gap-4 mt-8">
            <button
              onClick={prevTestimonial}
              className="p-3 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-[#1C4D8D] hover:text-white hover:border-[#1C4D8D] transition-all duration-300 shadow-md"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Dots */}
            <div className="flex gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setDirection(index > currentIndex ? 1 : -1);
                    setCurrentIndex(index);
                  }}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    index === currentIndex 
                      ? 'bg-[#1C4D8D] w-8' 
                      : 'bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={nextTestimonial}
              className="p-3 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-[#1C4D8D] hover:text-white hover:border-[#1C4D8D] transition-all duration-300 shadow-md"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

// Showcase Section Component
const ShowcaseSection = () => {
  const [isPaused, setIsPaused] = useState(false);

  return (
    <section className="py-24 bg-slate-900 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-[#1C4D8D]/20 rounded-full blur-3xl -translate-y-1/2"></div>
      <div className="absolute top-1/2 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2"></div>

      <div className="max-w-7xl mx-auto px-6 md:px-16 mb-12">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-yellow-300 text-sm font-semibold mb-6 backdrop-blur-sm">
            Featured Research
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Research <span className="text-yellow-400">Showcase</span>
          </h2>
          <p className="text-lg text-slate-400">
            Discover outstanding research works from NU Dasmariñas students and faculty
          </p>
        </div>
      </div>

      {/* Infinite Scroll Slider */}
      <div 
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <motion.div
          className="flex gap-6"
          animate={{
            x: isPaused ? 0 : [0, -1920]
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: 30,
              ease: "linear"
            }
          }}
          style={{ width: "fit-content" }}
        >
          {/* Double the items for seamless loop */}
          {[...showcaseItems, ...showcaseItems].map((item, index) => (
            <motion.div
              key={`${item.id}-${index}`}
              className="flex-shrink-0 w-[400px] bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-yellow-400/50 transition-all duration-500 hover:bg-white/10 group cursor-pointer"
              whileHover={{ y: -8, scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              {/* Category Badge */}
              <span className="inline-block px-3 py-1 rounded-full bg-[#1C4D8D]/30 text-yellow-300 text-xs font-semibold mb-4">
                {item.category}
              </span>

              {/* Title */}
              <h3 className="text-xl font-bold text-white mb-3 group-hover:text-yellow-300 transition-colors duration-300 line-clamp-2">
                {item.title}
              </h3>

              {/* Department */}
              <p className="text-[#1C4D8D] text-sm font-medium mb-4">
                {item.department}
              </p>

              {/* Authors */}
              <p className="text-slate-400 text-sm mb-4">
                {item.authors}
              </p>

              {/* Year */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <span className="text-slate-500 text-sm">{item.year}</span>
                <motion.div
                  className="text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  whileHover={{ x: 5 }}
                >
                  <ArrowRight size={20} />
                </motion.div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Gradient Overlays */}
        <div className="absolute top-0 left-0 w-32 h-full bg-gradient-to-r from-slate-900 to-transparent z-10 pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none"></div>
      </div>

      {/* View All Button */}
      <div className="text-center mt-12">
        <button className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-full font-semibold transition-all duration-300 backdrop-blur-sm inline-flex items-center gap-3 group">
          View All Research
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
        </button>
      </div>
    </section>
  );
};

export default Landing;
