import React, { useState } from 'react';
import Layout from './Layout';
import InboxList from './InboxList';
import TaskDetailsPane from './TaskDetailsPane';
import { ViewType, InboxItem, ValidationTask } from '../types';
import { Sparkles, ClipboardList, Database, CheckSquare, Plus, X, RefreshCw, LogOut } from 'lucide-react';
import { fetchWithAuth } from '../api';
import { useAuth } from '../AuthContext';

export default function Dashboard() {
  const [activeViewId, setActiveViewId] = useState<ViewType>('sap');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('inbox');
  const [notification, setNotification] = useState<{ message: string; success: boolean } | null>(null);

  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const { logout } = useAuth();

  const fetchTasks = async () => {
    setLoadingTasks(true);
    try {
      const response = await fetchWithAuth('/tasks');
      const tasks: ValidationTask[] = await response.json();
      
      const mappedItems: InboxItem[] = tasks.map(task => {
        const isSpecialType = task.kind === 'AOG_ALERT' || task.mission === 'M2';
        let statusLabel = 'PENDING HUMAN REVIEW';
        let colorTag = 'text-[#854d0e]';
        let bgTag = 'bg-[#fef08a]';
        let dotTag = 'bg-[#eab308]';

        if (isSpecialType) {
          statusLabel = 'URGENT REVIEW';
          colorTag = 'text-on-error-container';
          bgTag = 'bg-error-container';
          dotTag = 'bg-error';
        }

        // Determine viewId based on task kind or payload
        let viewId: ViewType = 'sap';
        if (task.kind === 'EMAIL_REPLY') {
          viewId = 'rag';
        } else if (isSpecialType) {
          viewId = 'aog';
        }

        // Fallback title/code
        let code = task.payload?.po_number || task.payload?.ncr_number || `TASK-${task.id}`;
        let title = task.kind.replace('_', ' ');

        return {
          id: `task-${task.id}`,
          viewId,
          code,
          title,
          summary: task.summary || 'No summary provided',
          status: statusLabel,
          statusColor: colorTag,
          statusBg: bgTag,
          statusDot: dotTag,
          time: new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          originalTask: task
        };
      });

      setInboxItems(mappedItems);
    } catch (err: any) {
      triggerNotification(`Failed to fetch tasks: ${err.message}`, false);
    } finally {
      setLoadingTasks(false);
    }
  };

  React.useEffect(() => {
    fetchTasks();
  }, []);

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
      {/* Top right actions overlay */}
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <button
          onClick={fetchTasks}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-outline rounded shadow-sm text-xs font-medium hover:bg-surface-container transition-colors"
          title="Refresh tasks"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingTasks ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-outline rounded shadow-sm text-xs font-medium hover:bg-surface-container text-rose-600 transition-colors"
          title="Logout"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </button>
      </div>
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
        activeTask={inboxItems.find(i => i.viewId === activeViewId)?.originalTask}
        onStatusChange={(msg, success) => {
          triggerNotification(msg, success);
          if (success) {
            // Refresh tasks on successful action
            fetchTasks();
          }
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
