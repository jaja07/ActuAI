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
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
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
        if (task.kind === 'RAG_ANSWER') {
          viewId = 'rag';
        } else if (task.kind === 'CREATE_FNC') {
          viewId = 'fnc';
        } else if (task.kind === 'TRACEABILITY_DOSSIER') {
          viewId = 'traceability';
        } else if (isSpecialType) {
          viewId = 'aog';
        }

        // Fallback title/code
        let code = task.payload?.serial_number || task.payload?.po_number || task.payload?.ncr_number || `TASK-${task.id}`;
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

  // "Simulate trigger" modal: posts a real email to the backend ingestion
  // endpoint, which runs one full Supervisor -> worker -> HITL cycle.
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [newSender, setNewSender] = useState('logistique@safran.com');
  const [newSubject, setNewSubject] = useState("Retard de livraison");
  const [newBody, setNewBody] = useState('');
  const [submittingTrigger, setSubmittingTrigger] = useState(false);

  const triggerNotification = (message: string, success: boolean) => {
    setNotification({ message, success });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const handleCreateInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBody.trim()) return;

    setSubmittingTrigger(true);
    try {
      const response = await fetchWithAuth('/ingest/email', {
        method: 'POST',
        body: JSON.stringify({ sender: newSender, subject: newSubject, body: newBody }),
      });
      const result = await response.json();
      setShowInspectionModal(false);
      setNewBody('');

      if (result.status === 'blocked') {
        triggerNotification(`Trigger blocked by guardrails: ${result.reason}`, false);
      } else {
        triggerNotification(`Agent cycle complete: ${result.summary || 'draft created'}`, true);
      }
      await fetchTasks();
    } catch (err: any) {
      triggerNotification(`Trigger failed: ${err.message}`, false);
    } finally {
      setSubmittingTrigger(false);
    }
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
        activeItemId={activeItemId}
        onItemSelect={(item) => {
          setActiveViewId(item.viewId);
          setActiveItemId(item.id);
          triggerNotification(`Loaded operations detail dossier: ${item.viewId.toUpperCase()}`, true);
        }}
        searchQuery={searchQuery}
      />

      {/* Detail Pane Wrapper */}
      <TaskDetailsPane
        activeViewId={activeViewId}
        activeTask={(inboxItems.find(i => i.id === activeItemId) ?? inboxItems.find(i => i.viewId === activeViewId))?.originalTask}
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
                Simulate Incoming Email
              </h3>
            </div>
            <p className="text-xs text-on-surface-variant mb-4">
              Submits a real email to the backend's ingestion endpoint
              (<code className="font-mono">/api/ingest/email</code>). The Supervisor
              agent classifies it and routes it to a worker, which drafts a task
              that appears in the inbox once the cycle completes.
            </p>

            <form onSubmit={handleCreateInspection} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-on-surface uppercase mb-1 font-mono">
                  Sender
                </label>
                <input
                  type="text"
                  className="w-full border border-outline rounded p-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                  placeholder="logistique@safran.com"
                  value={newSender}
                  onChange={(e) => setNewSender(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface uppercase mb-1 font-mono">
                  Subject
                </label>
                <input
                  type="text"
                  className="w-full border border-outline rounded p-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                  placeholder="Retard de livraison"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface uppercase mb-1 font-mono">
                  Email Body
                </label>
                <textarea
                  className="w-full border border-outline rounded p-2 text-xs h-28 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                  placeholder="Suite à un problème de matière première, la livraison de la commande PO-456123 prévue le 10 mai est repoussée au 15 mai."
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  required
                />
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
                  disabled={submittingTrigger}
                  className="px-4 py-2 bg-primary text-white rounded font-bold cursor-pointer hover:bg-primary/95 flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Plus className="w-4 h-4 text-white" /> {submittingTrigger ? 'Running agent cycle...' : 'Send to ActuAI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
