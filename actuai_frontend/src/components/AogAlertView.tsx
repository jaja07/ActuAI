import React, { useState } from 'react';
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

  const handleEscalationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask) return;
    try {
      await fetchWithAuth(`/tasks/${activeTask.id}/approve`, { method: 'POST' });
      setEscalated('escalated');
      setIsEscalating(false);
      if (onStatusChange) {
        onStatusChange(`AOG Critical Path priority escalated to Ops Director. Included note: "${escalationNote || 'None'}"`, true);
      }
    } catch (err: any) {
      if (onStatusChange) onStatusChange(`Escalation failed: ${err.message}`, false);
    }
  };

  const handleIgnore = async () => {
    if (!activeTask) return;
    try {
      await fetchWithAuth(`/tasks/${activeTask.id}/reject`, { method: 'POST' });
      setEscalated('ignored');
      if (onStatusChange) {
        onStatusChange("AOG warning logged. Alert suppressed, status: Ignore.", true);
      }
    } catch (err: any) {
      if (onStatusChange) onStatusChange(`Action failed: ${err.message}`, false);
    }
  };

  const handleReset = () => {
    setEscalated('none');
    setEscalationNote('');
    if (onStatusChange) {
      onStatusChange("AOG state restored to active review.", true);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Detail Header customized with RED AOG ALERT BRANDING */}
      <div className="p-6 border-b border-error/20 bg-error-container flex flex-col md:flex-row justify-between items-start gap-4 transition-all">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-label-md font-label-md text-on-error-container bg-error/10 px-2 py-1 rounded border border-error/20 font-bold font-mono">
              SN-7890
            </span>
            <span className="text-label-md font-label-md text-error flex items-center gap-1 font-semibold">
              <AlertCircle className="w-3.5 h-3.5" />
              Critical Path Impact Detected
            </span>
          </div>
          <h2 className="text-headline-md font-headline-md text-on-error-container tracking-tight">
            AOG Risk Alert: SN-7890 Final Assembly
          </h2>
        </div>

        {/* Action Header Tools */}
        <div className="flex gap-2 items-center">
          {escalated === 'none' ? (
            <>
              <button
                onClick={handleIgnore}
                className="px-4 py-2 bg-surface/80 border border-error/30 text-on-error-container rounded-DEFAULT font-label-md text-label-md hover:bg-surface transition-colors flex items-center gap-2 font-medium cursor-pointer"
              >
                Ignore
              </button>
              
              <button
                onClick={() => setIsEscalating(true)}
                className="px-4 py-2 bg-error text-on-error rounded-DEFAULT font-label-md text-label-md hover:bg-error/95 transition-all flex items-center gap-2 shadow-sm font-bold cursor-pointer hover:scale-[1.01]"
              >
                <AlertOctagon className="w-4 h-4 text-white" />
                Escalate to Director
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded font-bold text-xs uppercase ${
                escalated === 'escalated' 
                  ? 'bg-rose-700 text-white border border-rose-800' 
                  : 'bg-stone-200 text-stone-700 border border-stone-300'
              }`}>
                {escalated === 'escalated' ? '▲ ESCALATED' : '✓ CANCELED / IGNORED'}
              </span>
              <button 
                onClick={handleReset}
                className="p-1 px-2.5 rounded border border-outline hover:bg-surface-container-high text-xs text-on-surface flex items-center gap-1 cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" /> Reset Alert
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Manual Input Dialog Overlay for custom escalation notes */}
      {isEscalating && (
        <div className="bg-primary-container/20 backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-outline-variant max-w-md w-full rounded p-6 shadow-xl relative animate-fade-in">
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
              This triggers a high-priority system intervention. The operations supervisor and on-duty aeronautics director will be paged immediately via secured telemetry.
            </p>
            <form onSubmit={handleEscalationSubmit}>
              <label htmlFor="notes" className="block text-[11px] font-bold text-on-surface uppercase mb-1">
                Escalation Justification Input
              </label>
              <textarea
                id="notes"
                className="w-full border border-outline rounded p-2 text-xs font-sans h-24 focus:border-error focus:ring-1 focus:ring-error focus:outline-none placeholder:text-on-surface-variant/40"
                placeholder="Specify root-cause context or priority notes..."
                value={escalationNote}
                onChange={(e) => setEscalationNote(e.target.value)}
                required
              />
              <div className="mt-4 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsEscalating(false)}
                  className="px-3 py-1.5 border border-outline rounded cursor-pointer hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-error text-white rounded font-bold cursor-pointer hover:bg-error/90 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Transmit Escalation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Content Grid */}
      <div className="p-8 max-w-4xl mx-auto w-full flex-1 space-y-6">
        
        {escalated === 'escalated' && (
          <div className="bg-rose-50 border border-error/30 text-rose-800 p-4 rounded-lg flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 flex-shrink-0 text-error animate-bounce" />
            <div>
              <p className="font-bold text-sm">Escalation Transmitted</p>
              <p className="text-xs">
                SECURE PAGE DISPATCHED. Director on call will review the 3-day delta warning immediately.
              </p>
              {escalationNote && (
                <div className="mt-2 bg-white/60 p-2 text-xs rounded border border-rose-100 italic">
                  &ldquo;{escalationNote}&rdquo;
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-sm mb-6 relative overflow-hidden">
          {/* Subtle warning hazard pattern background */}
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none" 
            style={{ 
              backgroundImage: 'repeating-linear-gradient(45deg, #ba1a1a 0, #ba1a1a 10px, transparent 10px, transparent 20px)' 
            }} 
          />
          
          <h3 className="text-title-md font-title-md text-on-surface mb-6 relative z-10 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-error" />
            Timeline Conflict Detected
          </h3>

          <div className="relative z-10 flex flex-col space-y-4 font-code-md text-code-md">
            {/* Row 1 */}
            <div className="flex items-center justify-between p-4 bg-error/5 border border-error/20 rounded">
              <div className="flex items-center gap-2">
                <span className="w-24 font-bold text-error">Drop-Dead:</span>
                <span className="text-on-surface font-semibold">12-May-2024</span>
              </div>
              <div className="text-error font-label-md text-label-md flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
                Required for Engine Mount assembly
              </div>
            </div>

            {/* Path connector representation */}
            <div className="h-8 border-l-2 border-dashed border-error ml-16 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-error uppercase font-bold tracking-widest font-mono">
                CONSTRAINED PATH BLOCK
              </span>
            </div>

            {/* Row 2 */}
            <div className="flex items-center justify-between p-4 bg-surface-container border border-outline-variant rounded">
              <div className="flex items-center gap-2">
                <span className="w-24 font-bold text-on-surface-variant">Supplier ETA:</span>
                <span className="text-on-surface">15-May-2024</span>
              </div>
              <div className="text-on-surface-variant font-label-md text-label-md font-semibold">
                Current Commitment schedule
              </div>
            </div>

            {/* Delta calculations */}
            <div className="flex items-center p-4 bg-surface-container-high border border-outline-variant rounded">
              <span className="w-32 font-bold text-on-surface">Delta (Delay):</span>
              <span className="flex-1 text-error font-bold text-body-lg">3 Days</span>
              <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded font-bold font-mono">
                CRITICAL LIMIT EXCEEDED
              </span>
            </div>
          </div>
        </div>

        {/* Extra contextual asset information */}
        <div className="p-4 bg-surface-container-low rounded border border-outline-variant flex items-start gap-3">
          <HelpCircle className="w-4 h-4 text-[#76777d] mt-0.5 flex-shrink-0" />
          <div className="text-xs text-on-surface-variant space-y-1">
            <p className="font-semibold text-on-surface">How this resolution works:</p>
            <p>
              Components delayed past the drop-dead threshold will block production on the SN-7890 fuselage mounts. Escalate now to mobilize express freight and unlock the secondary assembly line buffers.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
