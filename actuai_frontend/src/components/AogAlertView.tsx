import React, { useEffect, useState } from 'react';
import { AlertCircle, ShieldAlert, Send, Undo2, X, AlertOctagon, HelpCircle } from 'lucide-react';
import { ValidationTask } from '../types';
import { fetchWithAuth } from '../api';

interface AogAlertViewProps {
  onStatusChange?: (statusMessage: string, success: boolean) => void;
  activeTask?: ValidationTask;
}

export default function AogAlertView({ onStatusChange, activeTask }: AogAlertViewProps) {
  const [escalated, setEscalated] = useState<'none' | 'escalated' | 'ignored'>('none');
  const [escalationNote, setEscalationNote] = useState('');
  const [isEscalating, setIsEscalating] = useState(false);

  useEffect(() => {
    setEscalated(
      activeTask?.status === 'EXECUTED' ? 'escalated'
        : activeTask?.status === 'REJECTED' ? 'ignored'
        : 'none'
    );
    setEscalationNote('');
  }, [activeTask?.id]);

  const payload = activeTask?.payload || {};
  const partReference = payload.part_reference || 'N/A';
  const poNumber = payload.po_number || 'N/A';
  const dropDeadDate = payload.drop_dead_date || '—';
  const supplierEta = payload.supplier_eta || '—';
  const delayDays = payload.delay_vs_dropdead_days ?? '?';
  const aircraftProgram = payload.aircraft_program || '';
  const detectedBy = payload.detected_by === 'proactive_scan' ? 'Proactive ETL scan' : 'Supplier delay email';

  const handleEscalationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask) return;
    try {
      await fetchWithAuth(`/tasks/${activeTask.id}/approve`, { method: 'POST' });
      setEscalated('escalated');
      setIsEscalating(false);
      onStatusChange?.(`AOG risk escalated: expedite request emailed to the supplier. Note: "${escalationNote || 'None'}"`, true);
    } catch (err: any) {
      onStatusChange?.(`Escalation failed: ${err.message}`, false);
    }
  };

  const handleIgnore = async () => {
    if (!activeTask) return;
    try {
      await fetchWithAuth(`/tasks/${activeTask.id}/reject`, { method: 'POST' });
      setEscalated('ignored');
      onStatusChange?.('AOG warning logged and suppressed (status: ignored).', true);
    } catch (err: any) {
      onStatusChange?.(`Action failed: ${err.message}`, false);
    }
  };

  const handleReset = () => {
    setEscalated('none');
    setEscalationNote('');
  };

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto">
      {/* Header with AOG branding */}
      <div className="p-6 border-b border-error/20 bg-error-container flex flex-col md:flex-row justify-between items-start gap-4 transition-all">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-label-md font-label-md text-on-error-container bg-on-error-container/10 px-2 py-1 rounded border border-on-error-container/20 font-bold font-mono">
              {poNumber}
            </span>
            <span className="text-label-md font-label-md text-on-error-container flex items-center gap-1 font-semibold">
              <AlertCircle className="w-3.5 h-3.5" />
              Critical Path Impact Detected
            </span>
            <span className="text-[10px] text-on-error-container/80 uppercase tracking-wider font-mono">
              via {detectedBy}
            </span>
          </div>
          <h2 className="text-headline-md font-headline-md text-on-error-container tracking-tight">
            AOG Risk Alert: {partReference} ({aircraftProgram})
          </h2>
          {activeTask?.summary && (
            <p className="text-on-error-container/80 text-body-md mt-1">{activeTask.summary}</p>
          )}
        </div>

        {/* Action Header Tools */}
        <div className="flex gap-2 items-center">
          {escalated === 'none' ? (
            <>
              <button
                onClick={handleIgnore}
                className="px-4 py-2 bg-surface/80 border border-on-error-container/30 text-on-error-container rounded font-label-md text-label-md hover:bg-surface transition-colors flex items-center gap-2 font-medium cursor-pointer"
              >
                Ignore
              </button>

              <button
                onClick={() => setIsEscalating(true)}
                className="px-4 py-2 bg-error text-on-error rounded font-label-md text-label-md hover:opacity-95 transition-all flex items-center gap-2 shadow-sm font-bold cursor-pointer hover:scale-[1.01]"
              >
                <AlertOctagon className="w-4 h-4" />
                Escalate to Director
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded font-bold text-xs uppercase ${
                escalated === 'escalated'
                  ? 'bg-status-urgent-bg text-status-urgent'
                  : 'bg-surface-container text-on-surface-variant'
              }`}>
                {escalated === 'escalated' ? '▲ ESCALATED' : '✓ IGNORED'}
              </span>
              <button
                onClick={handleReset}
                className="p-1 px-2.5 rounded border border-on-error-container/30 hover:bg-surface/60 text-xs text-on-error-container flex items-center gap-1 cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" /> Reset Alert
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Escalation modal */}
      {isEscalating && (
        <div className="bg-inverse-surface/30 backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant max-w-md w-full rounded-lg p-6 shadow-xl relative animate-fade-in">
            <button
              onClick={() => setIsEscalating(false)}
              className="absolute right-4 top-4 hover:bg-surface-container p-1 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4 text-on-surface" />
            </button>
            <h4 className="text-title-md font-bold mb-2 flex items-center gap-2 text-error">
              <ShieldAlert className="w-5 h-5" /> Execute Director Escalation
            </h4>
            <p className="text-xs text-on-surface-variant mb-4">
              Approving this alert sends an urgent expedite-shipping email to the supplier's
              logistics team and records the escalation in the audit trail.
            </p>
            <form onSubmit={handleEscalationSubmit}>
              <label htmlFor="notes" className="block text-[11px] font-bold text-on-surface uppercase mb-1">
                Escalation Justification
              </label>
              <textarea
                id="notes"
                className="w-full border border-outline rounded p-2 text-xs font-sans h-24 bg-surface text-on-surface focus:border-error focus:ring-1 focus:ring-error focus:outline-none placeholder:text-on-surface-variant/40"
                placeholder="Specify root-cause context or priority notes..."
                value={escalationNote}
                onChange={(e) => setEscalationNote(e.target.value)}
                required
              />
              <div className="mt-4 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsEscalating(false)}
                  className="px-3 py-1.5 border border-outline rounded cursor-pointer hover:bg-surface-container text-on-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-error text-on-error rounded font-bold cursor-pointer hover:opacity-90 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Transmit Escalation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Content */}
      <div className="p-6 md:p-8 max-w-4xl mx-auto w-full flex-1 space-y-6">
        {escalated === 'escalated' && (
          <div className="bg-status-urgent-bg text-status-urgent p-4 rounded-lg flex items-start gap-3 animate-fade-in">
            <AlertOctagon className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-bold text-sm">Escalation Transmitted</p>
              <p className="text-xs">
                An urgent expedite request was emailed to the supplier and logged in the audit trail.
              </p>
              {escalationNote && (
                <div className="mt-2 bg-surface-container-lowest/60 p-2 text-xs rounded italic">
                  &ldquo;{escalationNote}&rdquo;
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-sm relative overflow-hidden">
          {/* Subtle warning hazard pattern background */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[repeating-linear-gradient(45deg,var(--app-error)_0,var(--app-error)_10px,transparent_10px,transparent_20px)]" />

          <h3 className="text-title-md font-title-md text-on-surface mb-6 relative z-10 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-error" />
            Timeline Conflict Detected
          </h3>

          <div className="relative z-10 flex flex-col space-y-4 font-code-md text-code-md">
            {/* Drop-dead date */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-status-urgent-bg/40 border border-error/20 rounded">
              <div className="flex items-center gap-2">
                <span className="w-24 font-bold text-error">Drop-Dead:</span>
                <span className="text-on-surface font-semibold">{dropDeadDate}</span>
              </div>
              <div className="text-error font-label-md text-label-md flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
                Required for {aircraftProgram} assembly
              </div>
            </div>

            {/* Path connector */}
            <div className="h-8 border-l-2 border-dashed border-error ml-16 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-error uppercase font-bold tracking-widest font-mono">
                CONSTRAINED PATH BLOCK
              </span>
            </div>

            {/* Supplier ETA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-surface-container border border-outline-variant rounded">
              <div className="flex items-center gap-2">
                <span className="w-24 font-bold text-on-surface-variant">Supplier ETA:</span>
                <span className="text-on-surface">{supplierEta}</span>
              </div>
              <div className="text-on-surface-variant font-label-md text-label-md font-semibold">
                Current commitment schedule
              </div>
            </div>

            {/* Delta */}
            <div className="flex items-center p-4 bg-surface-container-high border border-outline-variant rounded">
              <span className="w-32 font-bold text-on-surface">Delta (Delay):</span>
              <span className="flex-1 text-error font-bold text-body-lg">{delayDays} Day(s)</span>
              <span className="text-[10px] bg-status-urgent-bg text-status-urgent px-2 py-0.5 rounded font-bold font-mono">
                CRITICAL LIMIT EXCEEDED
              </span>
            </div>
          </div>
        </div>

        {/* Contextual help */}
        <div className="p-4 bg-surface-container-low rounded border border-outline-variant flex items-start gap-3">
          <HelpCircle className="w-4 h-4 text-on-surface-variant mt-0.5 flex-shrink-0" />
          <div className="text-xs text-on-surface-variant space-y-1">
            <p className="font-semibold text-on-surface">How this resolution works:</p>
            <p>
              {partReference} delayed past the drop-dead threshold will block production on the {aircraftProgram} assembly line. Escalating sends an expedite-shipping request to the supplier immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
