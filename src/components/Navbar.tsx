import React, { useState } from 'react';
import { Menu, X, Lock, ArrowRight, Phone, Mail, Sparkles, Compass } from 'lucide-react';
import { SevaStore } from '../services/store';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isAdmin: boolean;
  onToggleAdmin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  isAdmin,
  onToggleAdmin,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About SEVA' },
    { id: 'approach', label: 'Our Approach' },
    { id: 'why-digital', label: 'Why Digital?' },
    { id: 'programme', label: 'Tech Support' },
    { id: 'impact', label: 'Our Impact' },
    { id: 'resources', label: 'Resources' },
    { id: 'contact', label: 'Contact Us' },
  ];

  const handleNavClick = (id: string) => {
    onNavigate(id);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {/* 1. Top Utility Bar for Institutional Transparency */}
      <div className="bg-[#064E36] text-[#F7FAF8] text-xs py-1.5 px-3 sm:px-6 lg:px-8 border-b border-[#0B6643]/50">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 text-emerald-100 font-medium tracking-tight">
            <span className="font-bold text-emerald-300">SEVA</span>
            <span>·</span>
            <span>Sustainable Ecology &amp; Village Advancement</span>
            <span className="hidden md:inline text-emerald-300/40">·</span>
            <span className="hidden md:inline text-emerald-200/90">Ralegaon, Yavatmal, Maharashtra</span>
          </div>

          <div className="flex items-center gap-4 text-emerald-100/90 font-medium">
            <a
              href="tel:+918999469974"
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span className="tabular-nums font-semibold">+91 8999469974</span>
            </a>
            <span className="text-emerald-300/40">·</span>
            <a
              href="mailto:seva.ecology@gmail.com"
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span className="hidden sm:inline font-semibold">seva.ecology@gmail.com</span>
              <span className="sm:hidden">Email</span>
            </a>
          </div>
        </div>
      </div>

      {/* 2. Main Header (Single Clean Tier matching Screenshot 2026-11-03 192708) */}
      <header className="sticky top-0 z-40 bg-white/98 backdrop-blur-md border-b border-stone-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3.5">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Brand Identity with Original Soft Mint Emblem */}
            <button
              onClick={() => handleNavClick('home')}
              className="text-left cursor-pointer group shrink-0 flex items-center gap-3 sm:gap-3.5"
              title="SEVA – Sustainable Ecology & Village Advancement"
            >
              {/* Original Light Mint Emblem Badge */}
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#E8F5E9] p-1 flex items-center justify-center shrink-0 border border-emerald-300/60 shadow-xs group-hover:scale-105 transition-transform">
                <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
                  <path d="M24 4 C14 12 10 24 16 36 C22 48 38 44 42 28 C46 12 34 6 24 4 Z" fill="#52B788" opacity="0.85" />
                  <line x1="12" y1="24" x2="36" y2="24" stroke="#A7F3D0" strokeWidth="1.5" strokeDasharray="2 2" />
                  <line x1="24" y1="12" x2="24" y2="36" stroke="#A7F3D0" strokeWidth="1.5" strokeDasharray="2 2" />
                  <circle cx="12" cy="24" r="2.5" fill="#F59E0B" />
                  <circle cx="36" cy="24" r="2.5" fill="#F59E0B" />
                  <circle cx="24" cy="12" r="2.5" fill="#38BDF8" />
                  <text x="24" y="32" textAnchor="middle" fill="#FFFFFF" fontSize="22" fontWeight="900" fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif">
                    S
                  </text>
                </svg>
              </div>

              {/* Original Brand Typography */}
              <div className="space-y-0.5">
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-[#143E29] group-hover:text-[#184E34] transition-colors leading-none block">
                  SEVA
                </span>
                <span className="block text-[10px] sm:text-[11px] font-bold text-[#184E34] tracking-tight uppercase leading-tight">
                  Sustainable Ecology &amp; Village Advancement
                </span>
              </div>
            </button>

            {/* Center: Desktop Navigation Links */}
            <nav className="hidden xl:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = currentView === link.id && !isAdmin;
                return (
                  <button
                    key={link.id}
                    onClick={() => handleNavClick(link.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-tight transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-emerald-50 text-[#143E29] font-extrabold border-b-2 border-[#184E34]'
                        : 'text-stone-600 hover:text-[#143E29] hover:bg-stone-50'
                    }`}
                  >
                    {link.label}
                  </button>
                );
              })}
            </nav>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
              <button
                onClick={onToggleAdmin}
                className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-bold rounded-full border transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-2xs ${
                  isAdmin
                    ? 'bg-[#184E34] text-white border-[#184E34]'
                    : 'bg-stone-50 text-[#254636] border-stone-200 hover:bg-stone-100 hover:text-stone-900'
                }`}
                title="सुरक्षित Admin Login"
              >
                <Lock className="w-3.5 h-3.5 text-[#D97706]" />
                <span className="hidden sm:inline">Admin Login</span>
                <span className="sm:hidden">Admin</span>
              </button>

              <button
                onClick={() => handleNavClick('apply')}
                className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-[#184E34] hover:bg-[#0F3825] rounded-full transition-all shadow-sm hover:shadow-md cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98]"
              >
                <span>Apply for Support</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>

              {/* Mobile & Tablet menu toggle button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="xl:hidden p-2 text-stone-700 hover:text-[#0B6643] rounded-xl border border-stone-200 focus:outline-none shrink-0 cursor-pointer"
                aria-label="Toggle Navigation Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile & Tablet dropdown menu */}
        {mobileMenuOpen && (
          <div className="xl:hidden bg-white border-t border-stone-200 px-4 pt-3 pb-6 space-y-2 shadow-xl animate-in slide-in-from-top-2 duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pb-2">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => handleNavClick(link.id)}
                  className={`block w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    currentView === link.id && !isAdmin
                      ? 'bg-emerald-50 text-[#143E29] font-bold border-l-4 border-[#184E34]'
                      : 'text-[#254636] hover:bg-stone-50'
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </div>
            <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => handleNavClick('apply')}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-[#184E34] hover:bg-[#0F3825] rounded-full shadow-xs cursor-pointer"
              >
                <span>Apply for Support</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </header>
    </>
  );
};
