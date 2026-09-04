import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import nuBuildingImg from '../assets/dasma.webp';
import nuLogoLeft from '../assets/left.png';

import NucleusLogoMark from '../components/branding/NucleusLogoMark';
import usePublicStats, { formatStatNumber } from '../hooks/usePublicStats';
import { 
  BookOpen, 
  Search, 
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Users,
  BarChart3,
  Globe,
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
  Upload,
  FileSearch,
  PenLine,
  BadgeCheck,
  Lightbulb,
  ClipboardList,
  UserCheck,
  LibraryBig,
} from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [navScrolled, setNavScrolled] = useState(false);
  const { researchPapers, activeScholars, departments, programs, loading: statsLoading } = usePublicStats();
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
              className="mb-12 max-w-2xl text-base font-medium leading-relaxed text-slate-200 sm:mb-16 md:mb-20 sm:text-lg md:text-xl"
            >
              A centralized digital ecosystem for academic excellence. Explore, submit, and discover
              verified research works from the National University Dasmariñas community.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
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
          </div>
        </div>
      </section>

      {/* About Section */}
      <AboutSection
        activeScholars={activeScholars}
        researchPapers={researchPapers}
        departments={departments}
        programs={programs}
        statsLoading={statsLoading}
      />

      {/* Process Section */}
      <ProcessSection />

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

const processSteps = [
  {
    icon: Upload,
    title: 'Submit',
    subtitle: 'Upload Your Research',
    desc: 'Students upload their research paper along with metadata, abstracts, and supporting files to begin the review pipeline.',
    role: 'Student Researcher',
    roleIcon: GraduationCap,
    features: [
      'Upload PDF with title, abstract, and keywords',
      'Select department, program, and adviser',
      'Attach supplementary materials and datasets',
    ],
    tips: [
      'Prepare your final PDF, title, abstract, keywords, and adviser before submitting',
      'Double-check metadata — incomplete submissions may be returned',
    ],
  },
  {
    icon: FileSearch,
    title: 'Review',
    subtitle: 'Faculty Evaluation',
    desc: 'Faculty advisers evaluate the submission against academic standards, providing structured feedback and scoring.',
    role: 'Faculty Adviser',
    roleIcon: UserCheck,
    features: [
      'Structured rubric-based evaluation criteria',
      'Inline comments and detailed feedback notes',
      'Accept, request revision, or escalate to editor',
    ],
    tips: [
      'Advisers receive notifications for new assignments',
      'Use the Review Queue to filter by status and track pending reviews',
    ],
  },
  {
    icon: PenLine,
    title: 'Revise',
    subtitle: 'Refine & Improve',
    desc: 'Students address reviewer feedback, strengthen methodology and conclusions, and resubmit for another review cycle.',
    role: 'Student Researcher',
    roleIcon: GraduationCap,
    features: [
      'View reviewer comments with highlighted sections',
      'Track revision history and change logs',
      'Resubmit directly from the action panel',
    ],
    tips: [
      'Read all notes before revising — address every point raised',
      'Use My Research to monitor status changes and revision outcomes',
    ],
  },
  {
    icon: BadgeCheck,
    title: 'Approve',
    subtitle: 'Final Approval',
    desc: 'The research editor validates metadata and the department head grants final approval for publication.',
    role: 'Research Editor / Admin',
    roleIcon: ClipboardList,
    features: [
      'Multi-tier approval with editor and admin sign-off',
      'Metadata validation and completeness check',
      'One-click publish or return for further revision',
    ],
    tips: [
      'Editors can return incomplete submissions at any stage',
      'Final approval logs are recorded for audit compliance',
    ],
  },
  {
    icon: BookOpen,
    title: 'Publish',
    subtitle: 'Go Live on NUCLEUS',
    desc: 'Approved papers are published to the NUCLEUS repository with proper indexing, citations, and digital rights protection.',
    role: 'System',
    roleIcon: LibraryBig,
    features: [
      'Automatic indexing and search optimization',
      'Digital rights management and access control',
      'Citation-ready metadata and permanent URL',
    ],
    tips: [
      'Published papers are immediately discoverable in search',
      'Authors receive a notification with the publication link',
    ],
  },
  {
    icon: Search,
    title: 'Discover',
    subtitle: 'Community Access',
    desc: 'The academic community browses, reads, cites, and builds upon published works — fueling future research and innovation.',
    role: 'All Users',
    roleIcon: Users,
    features: [
      'Advanced search with filters by department, year, and keywords',
      'AI-powered research assistant for insights',
      'Browse by category, program, or trending topics',
    ],
    tips: [
      'Use the AI assistant to get summaries and key findings',
      'Star papers to save them for later reference',
    ],
  },
];

const roleCards = [
  {
    icon: GraduationCap,
    title: 'Student Researcher',
    desc: 'Submit papers, respond to revision requests, and monitor each review stage from adviser approval through publication.',
    actions: ['Submit & track research', 'Respond to revision notes', 'Monitor publication status'],
  },
  {
    icon: UserCheck,
    title: 'Faculty Adviser',
    desc: 'Screen assigned research, leave academic feedback, and forward qualified papers to the next reviewer in the pipeline.',
    actions: ['Review assigned papers', 'Provide structured feedback', 'Approve or request revisions'],
  },
  {
    icon: ClipboardList,
    title: 'Research Editor',
    desc: 'Validate metadata, return incomplete submissions, and keep the institutional review pipeline moving efficiently.',
    actions: ['Validate submissions', 'Manage review queue', 'Ensure metadata quality'],
  },
];

// Row connector — animated separator between pairs
const RowConnector = ({ pairIndex }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-10px' });
  const fromStep = pairIndex * 2 + 1;
  const toStep = pairIndex * 2 + 2;

  return (
    <motion.div
      ref={ref}
      className="flex items-center gap-3 py-0.5"
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div
        className="h-px flex-1 origin-left bg-gradient-to-r from-[#1C4D8D]/20 to-slate-200"
        initial={{ scaleX: 0 }}
        animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
        style={{ transformOrigin: 'left' }}
        transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
      />
      <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-[#1C4D8D]/30" />
        <span className="text-[10px] font-semibold text-slate-400">
          Steps {fromStep}–{toStep} done
        </span>
        <ArrowRight size={10} className="text-[#1C4D8D]/50" />
      </div>
      <motion.div
        className="h-px flex-1 origin-right bg-gradient-to-l from-[#1C4D8D]/20 to-slate-200"
        initial={{ scaleX: 0 }}
        animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
        style={{ transformOrigin: 'right' }}
        transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
      />
    </motion.div>
  );
};

// Process step — bento card with watermark number
const ProcessStep = ({ step, index, pairOffset }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const Icon = step.icon;
  const RoleIcon = step.roleIcon;
  const stepNumber = index + 1;
  const stepLabel = String(stepNumber).padStart(2, '0');
  const xOffset = pairOffset === 0 ? -36 : 36;

  return (
    <motion.div
      ref={ref}
      className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow duration-300 hover:shadow-xl hover:shadow-[#1C4D8D]/8 sm:p-6"
      initial={{ opacity: 0, x: xOffset, y: 12 }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: xOffset, y: 12 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-3 -right-1 select-none text-[96px] font-black leading-none text-slate-900/[0.035] sm:text-[112px]"
      >
        {stepLabel}
      </span>

      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#1C4D8D]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1C4D8D]">
          Step {stepLabel}
        </span>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1C4D8D]/10 transition-all duration-300 group-hover:bg-[#1C4D8D] group-hover:shadow-md group-hover:shadow-[#1C4D8D]/20 sm:h-10 sm:w-10">
          <Icon size={18} className="text-[#1C4D8D] transition-colors duration-300 group-hover:text-white" />
        </div>
      </div>

      <h3 className="mb-0.5 text-lg font-bold text-slate-900">{step.title}</h3>
      <p className="mb-2 text-xs font-semibold tracking-wide text-[#1C4D8D]/70">{step.subtitle}</p>
      <p className="mb-4 text-sm leading-relaxed text-slate-500">{step.desc}</p>

      <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-700">Features</h4>
          <ul className="space-y-1.5">
            {step.features.map((f) => (
              <li key={f} className="flex items-start gap-1.5">
                <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-green-500" />
                <span className="text-xs leading-relaxed text-slate-600">{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-[#1C4D8D]/10 bg-[#1C4D8D]/[0.03] p-3">
          <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-700">Guidance</h4>
          <ul className="space-y-1.5">
            {step.tips.map((t) => (
              <li key={t} className="flex items-start gap-1.5">
                <Lightbulb size={12} className="mt-0.5 shrink-0 text-amber-500" />
                <span className="text-xs leading-relaxed text-slate-600">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
        <RoleIcon size={12} className="text-[#1C4D8D]/40" />
        <span className="text-xs font-medium text-slate-400">
          Handled by: <span className="font-semibold text-slate-600">{step.role}</span>
        </span>
      </div>
    </motion.div>
  );
};

// Role coverage card
const RoleCard = ({ role, index }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const Icon = role.icon;

  return (
    <motion.div
      ref={ref}
      className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-xl hover:shadow-[#1C4D8D]/8"
      initial={{ opacity: 0, y: 28 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1C4D8D]/10 transition-colors duration-300 group-hover:bg-[#1C4D8D]">
          <Icon size={22} className="text-[#1C4D8D] transition-colors duration-300 group-hover:text-white" />
        </div>
        <h3 className="text-base font-bold text-slate-900">{role.title}</h3>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-slate-500">{role.desc}</p>
      <ul className="space-y-2">
        {role.actions.map((a) => (
          <li key={a} className="flex items-start gap-2">
            <ArrowRight size={13} className="mt-0.5 shrink-0 text-[#1C4D8D]/40" />
            <span className="text-sm text-slate-600">{a}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
};

// Process Section — 2-column bento grid
const ProcessSection = () => {
  const pairs = [];
  for (let i = 0; i < processSteps.length; i += 2) {
    pairs.push(processSteps.slice(i, i + 2));
  }

  return (
    <section
      id="features"
      className="relative overflow-hidden bg-white py-16 sm:py-20"
      aria-label="How NUCLEUS works"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        aria-hidden="true"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #1C4D8D 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 md:px-16">
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
          <span className="mb-5 inline-block rounded-full bg-[#1C4D8D]/10 px-4 py-1.5 text-sm font-semibold text-[#1C4D8D]">
            How It Works
          </span>
          <h2 className="mb-4 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Your Research Journey,{' '}
            <span className="text-[#1C4D8D]">Step by Step</span>
          </h2>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
            A transparent, multi-tier process guiding your work from first upload to public discovery.
          </p>
        </div>

        <div className="mx-auto flex max-w-4xl flex-col gap-3.5">
          {pairs.map((pair, pairIdx) => (
            <React.Fragment key={pairIdx}>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {pair.map((step, stepInPair) => (
                  <ProcessStep
                    key={step.title}
                    step={step}
                    index={pairIdx * 2 + stepInPair}
                    pairOffset={stepInPair}
                  />
                ))}
              </div>
              {pairIdx < pairs.length - 1 && <RowConnector pairIndex={pairIdx} />}
            </React.Fragment>
          ))}
        </div>

        <div className="mt-14 sm:mt-20">
          <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-12">
            <span className="mb-4 inline-block rounded-full bg-green-100 px-4 py-1.5 text-sm font-semibold text-green-700">
              Role Coverage
            </span>
            <h3 className="mb-3 text-2xl font-bold text-slate-900 sm:text-3xl">
              Every Role, <span className="text-[#1C4D8D]">One Workflow</span>
            </h3>
            <p className="text-sm leading-relaxed text-slate-500 sm:text-base">
              Whether you submit, review, or approve — the same guided system serves every account.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {roleCards.map((role, i) => (
              <RoleCard key={role.title} role={role} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// About Section
const AboutSection = ({ activeScholars, researchPapers, departments, programs, statsLoading }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  const pillars = [
    {
      icon: BookOpen,
      title: 'Central Knowledge Repository',
      desc: 'A single source of truth for all academic research produced at NU Dasmariñas — organized, searchable, and permanent.',
    },
    {
      icon: Users,
      title: 'Multi-Tier Faculty Review',
      desc: 'Every submission passes through structured faculty evaluation before publication, ensuring integrity and quality.',
    },
    {
      icon: Globe,
      title: 'Open Academic Discovery',
      desc: 'Published works are indexed and accessible to every member of the NU community — students, faculty, and researchers.',
    },
  ];

  return (
    <section className="relative overflow-hidden bg-slate-50 py-20 sm:py-24" aria-label="About NUCLEUS">
      <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-[#1C4D8D]/5 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-400/5 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 md:px-16">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left: text + pillars */}
          <div ref={ref}>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="mb-5 inline-block rounded-full bg-[#1C4D8D]/10 px-4 py-1.5 text-sm font-semibold text-[#1C4D8D]">
                About the Platform
              </span>
              <h2 className="mb-5 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl lg:text-[2.6rem]">
                What is <span className="text-[#1C4D8D]">NUCLEUS</span>?
              </h2>
              <p className="mb-8 text-base leading-relaxed text-slate-500 sm:text-lg">
                NUCLEUS is the official digital research repository of National University Dasmariñas — a centralized platform 
                for submitting, reviewing, and discovering verified academic works from students and faculty across all colleges and departments.
              </p>
            </motion.div>

            <div className="space-y-3">
              {pillars.map((pillar, i) => {
                const Icon = pillar.icon;
                return (
                  <motion.div
                    key={pillar.title}
                    className="flex items-start gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                    initial={{ opacity: 0, x: -28 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.5, delay: 0.2 + i * 0.09, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1C4D8D]/10">
                      <Icon size={20} className="text-[#1C4D8D]" />
                    </div>
                    <div>
                      <h3 className="mb-0.5 font-semibold text-slate-900">{pillar.title}</h3>
                      <p className="text-sm leading-relaxed text-slate-500">{pillar.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Right: animated stats card */}
          <motion.div
            initial={{ opacity: 0, x: 48, scale: 0.97 }}
            animate={isInView ? { opacity: 1, x: 0, scale: 1 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#1C4D8D]/20 to-blue-400/10 blur-2xl opacity-60" aria-hidden="true" />
              <div className="relative rounded-2xl border border-slate-100 bg-white p-8 shadow-xl">
                <div className="mb-6 border-b border-slate-100 pb-6 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1C4D8D] to-blue-600 shadow-lg">
                    <Users size={28} className="text-white" />
                  </div>
                  <div className="mb-1 text-5xl font-black tabular-nums text-slate-900">
                    {statsLoading ? '…' : formatStatNumber(activeScholars)}
                  </div>
                  <div className="font-semibold text-[#1C4D8D]">Active Scholars</div>
                  <div className="mt-1 text-sm text-slate-400">Registered student accounts on NUCLEUS</div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-slate-50 p-4 text-center">
                    <div className="mb-1 text-2xl font-black tabular-nums text-slate-900">
                      {statsLoading ? '…' : formatStatNumber(researchPapers)}
                    </div>
                    <div className="text-xs font-medium text-slate-500">Published Papers</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 text-center">
                    <div className="mb-1 text-2xl font-black tabular-nums text-slate-900">
                      {statsLoading
                        ? '…'
                        : departments !== null
                          ? formatStatNumber(departments)
                          : '—'}
                    </div>
                    <div className="text-xs font-medium text-slate-500">Departments</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 text-center">
                    <div className="mb-1 text-2xl font-black tabular-nums text-slate-900">
                      {statsLoading
                        ? '…'
                        : programs !== null
                          ? formatStatNumber(programs)
                          : '—'}
                    </div>
                    <div className="text-xs font-medium text-slate-500">Courses</div>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-4 py-3">
                  <CheckCircle2 size={16} className="shrink-0 text-green-500" />
                  <span className="text-xs font-medium text-green-700">
                    Official repository — verified by National University Dasmariñas
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

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
  const navigate = useNavigate();
  const { user } = useAuth();
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
        <button
          type="button"
          onClick={() => navigate(user ? '/dashboard' : '/register')}
          className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-full font-semibold transition-all duration-300 backdrop-blur-sm inline-flex items-center gap-3 group"
        >
          View All Research
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
        </button>
      </div>
    </section>
  );
};

export default Landing;
