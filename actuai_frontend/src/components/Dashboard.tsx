import React, { useEffect, useMemo, useRef, useState } from 'react';
import Layout from './Layout';
import InboxList from './InboxList';
import TaskDetailsPane from './TaskDetailsPane';
import QualityView from './QualityView';
import DocumentsView from './DocumentsView';
import { ViewType, InboxItem, ValidationTask, TabId } from '../types';
import { ClipboardList, Plus, X, ArrowLeft } from 'lucide-react';
import { fetchWithAuth } from '../api';

const POLL_INTERVAL_MS = 20_000;

function taskToViewId(task: ValidationTask): ViewType {
  if (task.kind === 'RAG_ANSWER') return 'rag';
  if (task.kind === 'CREATE_FNC') return 'fnc';
  if (task.kind === 'TRACEABILITY_DOSSIER') return 'traceability';
  if (task.kind === 'AOG_ALERT' || task.mission === 'M2') return 'aog';
  return 'sap';
}

export default function Dashboard() {
  const [activeViewId, setActiveViewId] = useState<ViewType>('sap');
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('inbox');
  const [notification, setNotification] = useState<{ message: string; success: boolean } | null>(null);
  const [showDetailMobile, setShowDetailMobile] = useState(false);

  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const fetchingRef = useRef(false);

  const fetchTasks = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoadingTasks(true);
    try {
      const response = await fetchWithAuth('/tasks');
      const tasks: ValidationTask[] = await response.json();

      const mappedItems: InboxItem[] = tasks.map(task => {
        const viewId = taskToViewId(task);
        const urgent = viewId === 'aog';
        return {
          id: `task-${task.id}`,
          viewId,
          code: task.payload?.serial_number || task.payload?.po_number || task.payload?.ncr_number || `TASK-${task.id}`,
          title: task.kind.replace(/_/g, ' '),
          summary: task.summary || 'No summary provided',
          status: urgent ? 'URGENT REVIEW' : 'PENDING HUMAN REVIEW',
          statusTone: urgent ? 'urgent' : 'pending',
          time: new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          originalTask: task
        };
      });

      setInboxItems(mappedItems);
    } catch (err: any) {
      triggerNotification(`Failed to fetch tasks: ${err.message}`, false);
    } finally {
      fetchingRef.current = false;
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // Lightweight polling keeps the queue live as the mock service pushes
    // emails to the backend in the background.
    const interval = setInterval(fetchTasks, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Tab-scoped inbox: the sidebar tabs really filter the queue.
  const tabItems = useMemo(() => {
    if (activeTab === 'aog') return inboxItems.filter(i => i.viewId === 'aog');
    if (activeTab === 'traceability') return inboxItems.filter(i => i.viewId === 'traceability' || i.viewId === 'rag');
    return inboxItems;
  }, [inboxItems, activeTab]);

  const tabCounts: Partial<Record<TabId, number>> = useMemo(() => ({
    inbox: inboxItems.length,
    aog: inboxItems.filter(i => i.viewId === 'aog').length,
    traceability: inboxItems.filter(i => i.viewId === 'traceability' || i.viewId === 'rag').length,
  }), [inboxItems]);

  // "Simulate trigger" modal: posts a real email to the backend ingestion
  // endpoint, which runs one full Supervisor -> worker -> HITL cycle.
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [newSender, setNewSender] = useState('logistics@safran.com');
  const [newSubject, setNewSubject] = useState('Delivery delay');
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

  const isTaskTab = activeTab === 'inbox' || activeTab === 'aog' || activeTab === 'traceability';

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={(tab) => {
        setActiveTab(tab);
        setShowDetailMobile(false);
      }}
      onNewInspection={() => setShowInspectionModal(true)}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      tabCounts={tabCounts}
      pendingCount={inboxItems.length}
      onRefresh={fetchTasks}
      refreshing={loadingTasks}
    >
      {isTaskTab ? (
        <>
          {/* Inbox list: full width on mobile (unless a detail is open), left column on lg+ */}
          <div className={`${showDetailMobile ? 'hidden' : 'flex'} lg:flex w-full lg:w-1/3 lg:min-w-[320px] lg:max-w-[400px] flex-shrink-0 h-full`}>
            <InboxList
              items={tabItems}
              activeItemId={activeItemId}
              onItemSelect={(item) => {
                setActiveViewId(item.viewId);
                setActiveItemId(item.id);
                setShowDetailMobile(true);
              }}
              searchQuery={searchQuery}
            />
          </div>

          {/* Detail pane: hidden on mobile until an item is selected */}
          <div className={`${showDetailMobile ? 'flex' : 'hidden'} lg:flex flex-1 flex-col h-full overflow-hidden`}>
            {/* Mobile back bar */}
            <div className="lg:hidden flex items-center gap-2 px-4 py-2 border-b border-outline-variant bg-surface-container-lowest">
              <button
                onClick={() => setShowDetailMobile(false)}
                className="flex items-center gap-1.5 text-primary text-sm font-semibold cursor-pointer p-1 rounded hover:bg-surface-container-low"
              >
                <ArrowLeft className="w-4 h-4" /> Back to inbox
              </button>
            </div>
            <TaskDetailsPane
              activeViewId={activeViewId}
              activeTask={(tabItems.find(i => i.id === activeItemId) ?? inboxItems.find(i => i.id === activeItemId))?.originalTask}
              onStatusChange={(msg, success) => {
                triggerNotification(msg, success);
                if (success) {
                  fetchTasks();
                }
              }}
            />
          </div>
        </>
      ) : activeTab === 'quality' ? (
        <QualityView onNotify={triggerNotification} searchQuery={searchQuery} />
      ) : (
        <DocumentsView searchQuery={searchQuery} />
      )}

      {/* Single global toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-inverse-surface text-inverse-on-surface p-4 rounded-lg shadow-lg animate-fade-in flex flex-col gap-1 transition-all">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${notification.success ? 'bg-status-success' : 'bg-error animate-ping'}`} />
            <p className="font-bold text-xs uppercase tracking-widest">{notification.success ? 'Success' : 'Attention'}</p>
          </div>
          <p className="text-xs leading-relaxed opacity-90">
            {notification.message}
          </p>
        </div>
      )}

      {/* Simulate Email modal */}
      {showInspectionModal && (
        <div className="bg-inverse-surface/30 backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant max-w-lg w-full rounded-lg p-6 shadow-2xl relative animate-fade-in font-sans">
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
                  className="w-full border border-outline rounded p-2 text-xs bg-surface text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                  placeholder="logistics@safran.com"
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
                  className="w-full border border-outline rounded p-2 text-xs bg-surface text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                  placeholder="Delivery delay"
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
                  className="w-full border border-outline rounded p-2 text-xs h-28 bg-surface text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                  placeholder="Due to a raw-material issue, delivery of purchase order PO-456123 planned for May 10 is postponed to May 15."
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
                  className="px-4 py-2 bg-primary text-on-primary rounded font-bold cursor-pointer hover:opacity-90 flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" /> {submittingTrigger ? 'Running agent cycle...' : 'Send to ActuAI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
