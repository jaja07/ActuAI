import React, { useEffect, useState } from 'react';
import { Check, X, Undo2, ShieldAlert, Loader2 } from 'lucide-react';
import { ValidationTask } from '../../types';
import { fetchWithAuth } from '../../api';

export type Decision = 'pending' | 'approved' | 'rejected';

/** Decision state derived from the task, shared by ActionBar + DecisionBanner. */
export function useDecision(task?: ValidationTask): [Decision, (d: Decision) => void] {
  const derive = (): Decision =>
    task?.status === 'EXECUTED' ? 'approved' : task?.status === 'REJECTED' ? 'rejected' : 'pending';
  const [decision, setDecision] = useState<Decision>(derive);
  useEffect(() => {
    setDecision(derive());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);
  return [decision, setDecision];
}

interface ActionBarProps {
  task?: ValidationTask;
  decision: Decision;
  setDecision: (d: Decision) => void;
  onStatusChange?: (statusMessage: string, success: boolean) => void;
  approveLabel: string;
  approveIcon?: React.ReactNode;
  approvedPill?: string;
  rejectedPill?: string;
  approveSuccessMsg: string;
  rejectSuccessMsg: string;
  extraButtons?: React.ReactNode;
}

/**
 * The shared approve/reject control used by every validation view. One
 * implementation = one consistent look, loading state and error path.
 */
export function ActionBar({
  task,
  decision,
  setDecision,
  onStatusChange,
  approveLabel,
  approveIcon,
  approvedPill = '✓ Approved',
  rejectedPill = '✗ Rejected',
  approveSuccessMsg,
  rejectSuccessMsg,
  extraButtons,
}: ActionBarProps) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  const act = async (action: 'approve' | 'reject') => {
    if (!task || busy) return;
    setBusy(action);
    try {
      await fetchWithAuth(`/tasks/${task.id}/${action}`, { method: 'POST' });
      setDecision(action === 'approve' ? 'approved' : 'rejected');
      onStatusChange?.(action === 'approve' ? approveSuccessMsg : rejectSuccessMsg, true);
    } catch (err: any) {
      onStatusChange?.(`${action === 'approve' ? 'Approval' : 'Rejection'} failed: ${err.message}`, false);
    } finally {
      setBusy(null);
    }
  };

  if (decision === 'pending') {
    return (
      <div className="flex gap-2 flex-wrap items-center">
        {extraButtons}
        <button
          onClick={() => act('reject')}
          disabled={busy !== null}
          className="px-4 py-2 bg-error cursor-pointer text-on-error rounded font-label-md text-label-md hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm font-semibold disabled:opacity-60"
        >
          {busy === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          Reject
        </button>
        <button
          onClick={() => act('approve')}
          disabled={busy !== null}
          className="px-4 py-2 bg-primary cursor-pointer text-on-primary rounded font-label-md text-label-md hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm font-semibold disabled:opacity-60"
        >
          {busy === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : (approveIcon ?? <Check className="w-4 h-4" />)}
          {approveLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`px-3 py-1.5 rounded font-bold text-xs uppercase ${
          decision === 'approved'
            ? 'bg-status-success-bg text-status-success'
            : 'bg-status-urgent-bg text-status-urgent'
        }`}
      >
        {decision === 'approved' ? approvedPill : rejectedPill}
      </span>
      <button
        onClick={() => setDecision('pending')}
        className="p-1 px-2.5 rounded border border-outline hover:bg-surface-container-high text-xs text-on-surface flex items-center gap-1 cursor-pointer"
      >
        <Undo2 className="w-3.5 h-3.5" /> Undo Selection
      </button>
    </div>
  );
}

interface DecisionBannerProps {
  decision: Decision;
  approvedText: string;
  rejectedText: string;
}

/** The confirmation banner shown in the view body after a decision. */
export function DecisionBanner({ decision, approvedText, rejectedText }: DecisionBannerProps) {
  if (decision === 'pending') return null;
  const approved = decision === 'approved';
  return (
    <div
      className={`p-4 rounded shadow-xs flex items-center gap-3 animate-fade-in ${
        approved ? 'bg-status-success-bg text-status-success' : 'bg-status-urgent-bg text-status-urgent'
      }`}
    >
      <ShieldAlert className="w-5 h-5 flex-shrink-0" />
      <div>
        <p className="font-bold text-sm">Action Status</p>
        <p className="text-xs">{approved ? approvedText : rejectedText}</p>
      </div>
    </div>
  );
}
