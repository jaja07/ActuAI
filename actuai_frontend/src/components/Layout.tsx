import React, { useState } from 'react';
import {
  Search,
  Bell,
  Plus,
  Inbox,
  AlertTriangle,
  ShieldCheck,
  FileSearch,
  FileText,
  Activity,
  User,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import { TabId } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  onNewInspection: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  tabCounts: Partial<Record<TabId, number>>;
  pendingCount: number;
  onRefresh: () => void;
  refreshing: boolean;
}

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'inbox', label: 'Validation Inbox', icon: Inbox },
  { id: 'aog', label: 'AOG Alerts', icon: AlertTriangle },
  { id: 'quality', label: 'Quality / 8D', icon: ShieldCheck },
  { id: 'traceability', label: 'Traceability & Docs Search', icon: FileSearch },
  { id: 'documents', label: 'Indexed Documents', icon: FileText },
];

export default function Layout({
  children,
  activeTab,
  setActiveTab,
  onNewInspection,
  searchQuery,
  setSearchQuery,
  tabCounts,
  pendingCount,
  onRefresh,
  refreshing
}: LayoutProps) {
  const { username, role, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navContent = (
    <>
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary">
          <Activity className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-title-md font-title-md text-on-surface font-bold">ActuAI Operations</h2>
          <p className="text-label-md font-label-md text-on-surface-variant">AI Agents: Online</p>
        </div>
      </div>

      <div className="px-4 mb-6">
        <button
          onClick={() => {
            onNewInspection();
            setDrawerOpen(false);
          }}
          className="w-full bg-primary text-on-primary font-label-md text-label-md py-3 rounded flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-sm cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
        >
          <Plus className="w-4 h-4" />
          Simulate Email
        </button>
      </div>

      <ul className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const IconComp = item.icon;
          const isActive = activeTab === item.id;
          const count = tabCounts[item.id];
          return (
            <li key={item.id}>
              <button
                onClick={() => {
                  setActiveTab(item.id);
                  setDrawerOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-label-md font-label-md transition-all text-left cursor-pointer ${
                  isActive
                    ? 'bg-secondary-container text-on-secondary-container border-l-4 border-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <IconComp className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      item.id === 'aog'
                        ? 'bg-error-container text-on-error-container'
                        : 'bg-surface-container-highest text-on-surface-variant'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="px-6 py-3 mt-auto border-t border-outline-variant">
        <div className="flex items-center gap-2 justify-between">
          <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">On-Premise Edge Node</span>
          <span className="w-2 h-2 rounded-full bg-status-success"></span>
        </div>
        <p className="text-[9px] text-on-surface-variant/80 font-mono mt-1">EN9100 · HITL enforced</p>
      </div>
    </>
  );

  return (
    <div className="h-screen flex flex-col bg-surface text-on-surface font-body-md text-body-md antialiased relative selection:bg-secondary-container">
      {/* TopNavBar */}
      <header className="bg-surface-container-lowest border-b border-outline-variant flex justify-between items-center w-full px-4 md:px-margin py-2 z-50 gap-3">
        <div className="flex items-center gap-3">
          {/* Mobile drawer toggle */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden text-on-surface hover:bg-surface-container-low p-2 rounded-full cursor-pointer"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-title-md font-title-md font-black text-primary tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
            ActuAI
          </span>
          <span className="hidden lg:inline-block text-[11px] bg-surface-container text-on-surface-variant uppercase px-2 py-0.5 rounded-sm font-semibold tracking-wider border border-outline-variant">
            Aerospace Ops
          </span>
        </div>

        {/* Global search */}
        <div className="hidden sm:flex items-center bg-surface-container-low rounded-full px-4 py-2 flex-1 max-w-md border border-outline-variant focus-within:border-primary transition-colors">
          <Search className="w-4 h-4 text-on-surface-variant mr-2 flex-shrink-0" />
          <input
            className="bg-transparent border-none focus:outline-none focus:ring-0 text-body-md w-full text-on-surface p-0 placeholder-on-surface-variant"
            placeholder="Search operations, serials, POs..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Right-side controls */}
        <div className="flex items-center gap-1 md:gap-2">
          <button
            onClick={onRefresh}
            className="text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors p-2 rounded-full cursor-pointer"
            title="Refresh tasks"
            aria-label="Refresh tasks"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={toggle}
            className="text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors p-2 rounded-full cursor-pointer"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle dark mode"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setActiveTab('inbox')}
            className="relative text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors p-2 rounded-full cursor-pointer"
            title={`${pendingCount} task(s) pending validation`}
            aria-label="Pending validation tasks"
          >
            <Bell className="w-5 h-5" />
            {pendingCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-0.5 bg-error text-on-error font-bold text-[9px] rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>

          {/* User profile */}
          <div className="flex items-center gap-2 border-l border-outline-variant pl-2 md:pl-4">
            <div className="w-8 h-8 rounded-full bg-surface-variant border border-outline-variant flex items-center justify-center">
              <User className="w-4 h-4 text-on-surface-variant" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-[11px] font-semibold text-on-surface line-clamp-1">{username ?? '—'}</p>
              <p className="text-[9px] text-on-surface-variant leading-none uppercase">{role ?? ''}</p>
            </div>
            <button
              onClick={logout}
              title="Log out"
              className="text-on-surface-variant hover:text-error hover:bg-surface-container-low transition-colors p-1.5 rounded-full cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <nav className="hidden md:flex flex-col w-64 bg-surface-container-low border-r border-outline-variant z-40 h-full pt-6 pb-4">
          {navContent}
        </nav>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-xs"
              onClick={() => setDrawerOpen(false)}
            />
            <nav className="relative flex flex-col w-72 max-w-[85%] bg-surface-container-low h-full pt-6 pb-4 shadow-2xl animate-fade-in">
              <button
                onClick={() => setDrawerOpen(false)}
                className="absolute right-3 top-3 p-1.5 rounded-full hover:bg-surface-container cursor-pointer text-on-surface"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
              {navContent}
            </nav>
          </div>
        )}

        {/* Content Canvas */}
        <div className="flex-1 flex overflow-hidden relative">
          {children}
        </div>
      </div>
    </div>
  );
}
