import React from 'react';

export type StatusTone = 'pending' | 'urgent' | 'success' | 'info' | 'neutral';

const TONE_CLASSES: Record<StatusTone, string> = {
  pending: 'bg-status-pending-bg text-status-pending',
  urgent: 'bg-status-urgent-bg text-status-urgent',
  success: 'bg-status-success-bg text-status-success',
  info: 'bg-status-info-bg text-status-info',
  neutral: 'bg-surface-container text-on-surface-variant',
};

const DOT_CLASSES: Record<StatusTone, string> = {
  pending: 'bg-status-pending',
  urgent: 'bg-status-urgent',
  success: 'bg-status-success',
  info: 'bg-status-info',
  neutral: 'bg-on-surface-variant',
};

interface StatusPillProps {
  tone: StatusTone;
  label: string;
  pulse?: boolean;
  className?: string;
}

/** The single way status chips are rendered across the app (theme-aware). */
export default function StatusPill({ tone, label, pulse = false, className = '' }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-label-md font-bold uppercase tracking-wider ${TONE_CLASSES[tone]} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${DOT_CLASSES[tone]} ${pulse ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  );
}
