import React, { useState } from 'react';
import { 
  Search, 
  Bell, 
  HelpCircle, 
  Plus, 
  Inbox, 
  AlertTriangle, 
  ShieldCheck, 
  FileSearch, 
  Settings,
  Activity,
  User,
  Info
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onNewInspection: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function Layout({
  children,
  activeTab,
  setActiveTab,
  onNewInspection,
  searchQuery,
  setSearchQuery
}: LayoutProps) {
  const [showNotificationCount, setShowNotificationCount] = useState(3);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const navItems = [
    { id: 'inbox', label: 'Validation Inbox', icon: Inbox, color: 'text-on-secondary-container' },
    { id: 'aog', label: 'AOG Alerts', icon: AlertTriangle, color: 'text-on-surface-variant' },
    { id: 'quality', label: 'Quality (FNC)', icon: ShieldCheck, color: 'text-on-surface-variant' },
    { id: 'traceability', label: 'Traceability Search', icon: FileSearch, color: 'text-on-surface-variant' },
    { id: 'settings', label: 'Settings', icon: Settings, color: 'text-on-surface-variant' }
  ];

  return (
    <div class="h-screen flex flex-col bg-surface text-on-surface font-body-md text-body-md antialiased relative selection:bg-secondary-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-20 right-6 z-50 bg-primary-container text-white text-body-md px-4 py-3 rounded shadow-md border border-outline flex items-center gap-2 animate-bounce">
          <Info className="w-4 h-4 text-inverse-primary" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TopNavBar */}
      <header className="bg-surface-container-lowest border-b border-outline-variant flex justify-between items-center w-full px-spacing-margin py-2 z-50">
        <div className="flex items-center gap-4">
          <span className="text-title-md font-title-md font-black text-primary tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse"></span>
            ActuAI
          </span>
          <span className="hidden lg:inline-block text-[11px] bg-surface-container text-on-surface-variant uppercase px-2 py-0.5 rounded-sm font-semibold tracking-wider border border-outline-variant">
            Aerospace Ops
          </span>
        </div>

        {/* Global Action Search bar */}
        <div className="flex items-center bg-surface-container-low rounded-full px-4 py-2 w-1/3 border border-outline-variant focus-within:border-primary transition-colors">
          <Search className="w-4 h-4 text-on-surface-variant mr-2" />
          <input
            className="bg-transparent border-none focus:outline-none focus:ring-0 text-body-md w-full text-on-surface p-0 placeholder-on-surface-variant"
            placeholder="Search operations, serials, POs..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Right side Profile & system quick toggles */}
        <div className="flex items-center gap-4">
          <button 
            role="button"
            aria-label="Toggle notifications"
            onClick={() => {
              if (showNotificationCount > 0) {
                setShowNotificationCount(0);
                triggerToast("Cleared system alerts and updates.");
              } else {
                setShowNotificationCount(3);
                triggerToast("Reset simulated system alerts.");
              }
            }}
            className="relative text-primary hover:bg-surface-container-low transition-colors p-2 rounded-full cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {showNotificationCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-error text-white font-bold text-[9px] rounded-full flex items-center justify-center animate-pulse">
                {showNotificationCount}
              </span>
            )}
          </button>
          
          <button 
            onClick={() => triggerToast("Aerospace System Hub v4.1.14 - Under Strict Compliance Protocol")}
            className="text-primary hover:bg-surface-container-low transition-colors p-2 rounded-full cursor-pointer"
            aria-label="System help documentation"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* User profile with industrial context */}
          <div className="flex items-center gap-2 border-l border-outline-variant pl-4">
            <div className="w-8 h-8 rounded-full bg-surface-variant border border-outline-variant overflow-hidden">
              <img
                alt="J. Doe - Quality Inspector"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDUODv23_WuVw2YKE7mBxq8Gy8kF0zm4_8mPMmn7Itcw4BGhqFffA5nUFqclzlr0U8p1rhmPR9Gvjr9u4phrpDjENe-yx_1kbcov6nGAyner7D9cWkOfOVp31LkQ8lwOgvudkllL_CXIzwHJ_n7dHeAJOUnkx3u9EbaivcesFJoILhZ4ChFnN1vP2j7Pm46GfkvhTVEQgqH0Xx-4O5r-YKU2HUBLFZ0eONUEW_GUYGp4gVsJwOwHJb7"
              />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-[11px] font-semibold text-on-surface line-clamp-1">J. Doe</p>
              <p className="text-[9px] text-on-surface-variant leading-none uppercase">Lead Inspector</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* SideNavBar */}
        <nav className="hidden md:flex flex-col w-64 bg-surface-container-low border-r border-outline-variant z-40 h-full pt-6 pb-4">
          <div className="px-6 mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-primary flex items-center justify-center text-on-primary">
              <Activity className="w-5 h-5 text-inverse-primary" />
            </div>
            <div>
              <h2 className="text-title-md font-title-md text-primary font-bold">ActuAI Operations</h2>
              <p className="text-label-md font-label-md text-on-surface-variant">AI Agents: Online</p>
            </div>
          </div>

          <div className="px-4 mb-6">
            <button
              onClick={onNewInspection}
              className="w-full bg-primary text-on-primary font-label-md text-label-md py-3 rounded-DEFAULT flex items-center justify-center gap-2 hover:bg-primary/95 transition-all shadow-sm cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
            >
              <Plus className="w-4 h-4" />
              Simulate Email
            </button>
          </div>

          <ul className="flex-1 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      setActiveTab(item.id);
                      if (item.id !== 'inbox') {
                        triggerToast(`Switched back to simulated tab: ${item.label}`);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-label-md font-label-md transition-all text-left cursor-pointer ${
                      isActive
                        ? 'bg-secondary-container text-on-secondary-container translate-x-1 border-l-4 border-primary'
                        : 'text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    <IconComp className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Compliance notice footer */}
          <div className="px-6 py-2 mt-auto border-t border-outline-variant">
            <div className="flex items-center gap-2 justify-between">
              <span className="text-[10px] text-on-surface-variant">SECURE HOST</span>
              <span className="w-2 h-2 rounded-full bg-[#15803d]"></span>
            </div>
            <p className="text-[9px] text-[#76777d]/90 font-mono mt-1">PROT_DEC_V39_COM</p>
          </div>
        </nav>

        {/* Content Canvas */}
        <div className="flex-1 flex overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
