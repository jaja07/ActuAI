import React, { useState } from 'react';
import Layout from './Layout';
import InboxList from './InboxList';
import TaskDetailsPane from './TaskDetailsPane';
import { ViewType, InboxItem } from '../types';
import { Sparkles, ClipboardList, Database, CheckSquare, Plus, X } from 'lucide-react';

export default function Dashboard() {
  const [activeViewId, setActiveViewId] = useState<ViewType>('sap');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('inbox');
  const [notification, setNotification] = useState<{ message: string; success: boolean } | null>(null);

  // Initial registry simulation state
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([
    {
      id: 'item-1',
      viewId: 'sap',
      code: 'PO-456123',
      title: 'SAP Date Update',
      summary: 'Supplier requested delivery shift to 15-May. Conflicts with dependent assembly schedule.',
      status: 'PENDING HUMAN REVIEW',
      statusColor: 'text-[#854d0e]',
      statusBg: 'bg-[#fef08a]',
      statusDot: 'bg-[#eab308]',
      time: '10m ago'
    },
    {
      id: 'item-2',
      viewId: 'aog',
      code: 'SN-7890',
      title: 'AOG Risk Alert',
      summary: 'Critical component delay detected. Impact on SN-7890 final assembly line.',
      status: 'URGENT REVIEW',
      statusColor: 'text-on-error-container',
      statusBg: 'bg-error-container',
      statusDot: 'bg-error',
      time: '1h ago'
    },
    {
      id: 'item-3',
      viewId: 'rag',
      code: "Project 'Skyward'",
      title: 'RAG Synthesis',
      summary: '8D report analysis complete. Review AI-generated summary for root cause.',
      status: 'DRAFT READY',
      statusColor: 'text-[#854d0e]',
      statusBg: 'bg-[#fef08a]',
      statusDot: 'bg-[#eab308]',
      time: '2h ago'
    }
  ]);

  // Modal inspection setup simulation state
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newType, setNewType] = useState<ViewType>('rag');

  const triggerNotification = (message: string, success: boolean) => {
    setNotification({ message, success });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const handleCreateInspection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newTitle || !newSummary) return;

    // Define mock card metadata
    const isSpecialType = newType === 'aog';
    const statusLabel = isSpecialType ? 'URGENT REVIEW' : 'PENDING HUMAN REVIEW';
    const colorTag = isSpecialType ? 'text-on-error-container' : 'text-[#854d0e]';
    const bgTag = isSpecialType ? 'bg-error-container' : 'bg-[#fef08a]';
    const dotTag = isSpecialType ? 'bg-error' : 'bg-[#eab308]';

    const newItem: InboxItem = {
      id: `item-${Date.now()}`,
      viewId: newType,
      code: newCode.trim(),
      title: newTitle.trim(),
      summary: newSummary.trim(),
      status: statusLabel,
      statusColor: colorTag,
      statusBg: bgTag,
      statusDot: dotTag,
      time: 'Just now'
    };

    setInboxItems(prev => [newItem, ...prev]);
    setActiveViewId(newType);
    setShowInspectionModal(false);

    // Reset fields
    setNewCode('');
    setNewTitle('');
    setNewSummary('');
    setNewType('rag');

    triggerNotification(`Created inspection registry profile: ${newItem.code} - ${newItem.title}`, true);
  };

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onNewInspection={() => setShowInspectionModal(true)}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
    >
      {/* Dynamic Inbox items list (Left Panel) and active inspection content (Right Panel) */}
      <InboxList
        items={inboxItems}
        activeViewId={activeViewId}
        onItemSelect={(viewId) => {
          setActiveViewId(viewId);
          triggerNotification(`Loaded operations detail dossier: ${viewId.toUpperCase()}`, true);
        }}
        searchQuery={searchQuery}
      />

      {/* Detail Pane Wrapper */}
      <TaskDetailsPane
        activeViewId={activeViewId}
        onStatusChange={(msg, success) => {
          triggerNotification(msg, success);
        }}
      />

      {/* Global Toast Banner Logs */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 border border-outline text-white p-4 rounded shadow-lg animate-fade-in flex flex-col gap-1 transition-all">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${notification.success ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'}`} />
            <p className="font-bold text-xs uppercase text-inverse-primary tracking-widest font-mono">System Signal Status</p>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {notification.message}
          </p>
        </div>
      )}

      {/* Inspection Creator Modal sheet */}
      {showInspectionModal && (
        <div className="bg-primary/20 backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-outline-variant max-w-lg w-full rounded p-6 shadow-2xl relative animate-fade-in font-sans">
            <button 
              onClick={() => setShowInspectionModal(false)}
              className="absolute right-4 top-4 hover:bg-surface-container p-1 rounded-full cursor-pointer text-on-surface"
              aria-label="Close form button"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2 mb-4 text-primary">
              <ClipboardList className="w-6 h-6 text-primary" />
              <h3 className="text-title-md font-bold tracking-tight text-on-surface">
                Create Flight inspection Entry
              </h3>
            </div>

            <form onSubmit={handleCreateInspection} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-on-surface uppercase mb-1 font-mono">
                  Dossier Serial Code (e.g. SN-8921 or PO-94819)
                </label>
                <input
                  type="text"
                  className="w-full border border-outline rounded p-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                  placeholder="PO-4912 or Project 'Titan'"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface uppercase mb-1 font-mono">
                  Mission Identifier Title
                </label>
                <input
                  type="text"
                  className="w-full border border-outline rounded p-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                  placeholder="e.g. Turbine Rotor Tolerance Test"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface uppercase mb-1 font-mono">
                  Analysis Summary & Details
                </label>
                <textarea
                  className="w-full border border-outline rounded p-2 text-xs h-20 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                  placeholder="Enter telemetry coordinates, delay details, or supplier requested changes..."
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface uppercase mb-1 font-mono">
                  Validation Flow Pipeline Target
                </label>
                <select
                  className="w-full border border-outline rounded p-2 text-xs bg-white text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as ViewType)}
                >
                  <option value="sap">SAP Date Update (Interactive Split Diff View)</option>
                  <option value="aog">AOG Risk Warning (Urgent Timeline Conflict Panel)</option>
                  <option value="rag">RAG Synthesis (Simulated AI Co-Pilot chat session)</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowInspectionModal(false)}
                  className="px-3 py-2 border border-outline rounded cursor-pointer hover:bg-surface-container text-on-surface-variant"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded font-bold cursor-pointer hover:bg-primary/95 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-white" /> Inject Entry Dossier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
