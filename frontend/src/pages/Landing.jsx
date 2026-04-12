import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import nuBuildingImg from '../assets/dasma.png.jpeg';
import nuLogoLeft from '../assets/left.png';

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
  Shield,
  MapPin,
  Phone,
  Mail,
  Clock,
  Quote,
  ChevronLeft,
  ChevronRight,
  Star
} from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white font-sans text-slate-900 antialiased">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 md:px-16 py-6 absolute top-0 w-full z-50 bg-gradient-to-b from-slate-900/90 to-transparent backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-[#1C4D8D] to-[#2563eb] rounded-xl flex items-center justify-center shadow-lg">
            <Library size={24} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xl tracking-tight text-white">
              NUCLEUS
            </span>
            <span className="text-xs text-white/70 font-medium">NU Dasmariñas</span>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-white/90 hover:text-white transition-colors hover:underline decoration-[#1C4D8D] decoration-2 underline-offset-4">Features</a>
          <a href="#stats" className="text-sm font-medium text-white/90 hover:text-white transition-colors hover:underline decoration-[#1C4D8D] decoration-2 underline-offset-4">Impact</a>
          <div className="h-6 w-px bg-white/20 mx-2"></div>
          {authAction}
        </div>

        <div className="md:hidden">
          {user ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="rounded-lg bg-[#1C4D8D] px-4 py-2 text-sm font-semibold text-white shadow-md"
            >
              Dashboard
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="rounded-lg border border-white/20 px-3 py-2 text-sm font-medium text-white/95 backdrop-blur-sm">
                Sign In
              </Link>
              <Link to="/register" className="rounded-lg bg-[#1C4D8D] px-3 py-2 text-sm font-semibold text-white shadow-md">
                Get Started
              </Link>
            </div>
          )}
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
          <div className="absolute inset-0 bg-gradient-to-r from-[#1C4D8D]/70 via-[#1C4D8D]/50 to-[#1C4D8D]/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-16 relative z-10 w-full">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-semibold mb-8 tracking-wide backdrop-blur-md">
              <GraduationCap size={16} className="text-yellow-300" />
              National University Dasmariñas • Academic Repository
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tight mb-6 leading-[1.1]">
              Preserving Knowledge, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-200 to-yellow-300">
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
                className="w-full sm:w-auto px-8 py-3.5 bg-[#1C4D8D] hover:bg-[#163a6b] text-white rounded-xl font-bold text-base transition-all shadow-xl hover:shadow-2xl hover:shadow-[#1C4D8D]/30 flex items-center justify-center gap-3 group transform hover:-translate-y-0.5"
              >
                <BookOpen size={20} />
                Explore Repository
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              
              <div className="flex items-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/15 backdrop-blur-md">
                <Shield size={18} className="text-yellow-400" />
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
      <section id="features" className="py-28 bg-white relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #1C4D8D 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
        
        <div className="max-w-7xl mx-auto px-6 md:px-16 relative">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#1C4D8D]/10 text-[#1C4D8D] text-sm font-semibold mb-6">
              Why Choose NUCLEUS
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              Academic Excellence, <br className="hidden md:block" />
              <span className="text-[#1C4D8D]">Digitized</span>
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed">
              A comprehensive platform designed to support the entire research lifecycle 
              at National University Dasmariñas
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-24">
            <FeatureCard 
              icon={<Search className="text-[#1C4D8D]" size={26} />}
              title="Intelligent Discovery"
              desc="Advanced search algorithms and filters to navigate decades of institutional knowledge with precision."
              index={0}
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
                    <div className="text-5xl font-bold text-slate-900 mb-2">1,000+</div>
                    <div className="text-xl text-[#1C4D8D] font-semibold mb-2">Active Scholars</div>
                    <div className="text-slate-500">Engaged in research activities daily</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-slate-100">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900">500+</div>
                      <div className="text-sm text-slate-500">Papers Submitted</div>
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

const FeatureCard = ({ icon, title, desc, index }) => (
  <div 
    className="group relative bg-white p-8 rounded-2xl border border-slate-100 hover:border-[#1C4D8D]/20 transition-all duration-500 hover:shadow-2xl hover:shadow-[#1C4D8D]/10"
    style={{ animationDelay: `${index * 100}ms` }}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-[#1C4D8D]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"></div>
    <div className="relative">
      <div className="w-14 h-14 rounded-xl bg-[#1C4D8D]/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-[#1C4D8D] transition-all duration-300">
        <div className="group-hover:text-white transition-colors duration-300">
          {icon}
        </div>
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-[#1C4D8D] transition-colors duration-300">{title}</h3>
      <p className="text-slate-500 leading-relaxed">{desc}</p>
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
