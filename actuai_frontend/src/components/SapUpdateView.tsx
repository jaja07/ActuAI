import React, { useState } from 'react';
import { Edit2, X, Check, ArrowRight, Mail, GitCompare, ShieldAlert, Undo2 } from 'lucide-react';
import { ValidationTask } from '../types';
import { fetchWithAuth } from '../api';

interface SapUpdateViewProps {
  onStatusChange?: (statusMessage: string, success: boolean) => void;
  activeTask?: ValidationTask;
}

export default function SapUpdateView({ onStatusChange, activeTask }: SapUpdateViewProps) {
  const [decision, setDecision] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const handleApprove = async () => {
    if (!activeTask) return;
    try {
      await fetchWithAuth(`/tasks/${activeTask.id}/approve`, { method: 'POST' });
      setDecision('approved');
      if (onStatusChange) {
        onStatusChange('SAP Date Update Request successfully approved. System scheduled synchronization.', true);
      }
    } catch (err: any) {
      if (onStatusChange) onStatusChange(`Approval failed: ${err.message}`, false);
    }
  };

  const handleReject = async () => {
    if (!activeTask) return;
    try {
      await fetchWithAuth(`/tasks/${activeTask.id}/reject`, { method: 'POST' });
      setDecision('rejected');
      if (onStatusChange) {
        onStatusChange('SAP Date Update Request has been rejected. Dispatched override back to supplier.', true);
      }
    } catch (err: any) {
      if (onStatusChange) onStatusChange(`Rejection failed: ${err.message}`, false);
    }
  };

  const handleUndo = () => {
    setDecision('pending');
    if (onStatusChange) {
      onStatusChange('Decision resetting...', true);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Detail Header area */}
      <div className="p-6 border-b border-outline-variant bg-surface-container-lowest flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-label-md font-label-md text-primary bg-primary-container px-2.5 py-1 rounded font-mono font-bold">
              PO-456123
            </span>
            <span className="text-label-md font-label-md text-on-surface-variant font-medium">
              SAP Logistics Division
            </span>
          </div>
          <h2 className="text-headline-md font-headline-md text-on-surface">
            SAP Date Update Request
          </h2>
        </div>

        {/* Header Action Tools */}
        <div className="flex gap-2 flex-wrap items-center">
          {decision === 'pending' ? (
            <>
              <button 
                onClick={() => alert("Launching manual date field editing form...")}
                className="px-4 py-2 bg-surface cursor-pointer border border-outline-variant text-on-surface rounded-DEFAULT font-label-md text-label-md hover:bg-surface-container transition-colors flex items-center gap-2 font-medium"
              >
                <Edit2 className="w-4 h-4 text-on-surface" />
                Edit
              </button>
              
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-error cursor-pointer text-on-error rounded-DEFAULT font-label-md text-label-md hover:bg-error/90 transition-colors flex items-center gap-2 shadow-sm font-semibold"
              >
                <X className="w-4 h-4 text-white" />
                Reject
              </button>
              
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-[#166534] cursor-pointer text-white rounded-DEFAULT font-label-md text-label-md hover:bg-[#15803d]/90 transition-colors flex items-center gap-2 shadow-sm font-semibold"
              >
                <Check className="w-4 h-4 text-white" />
                Approve
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded font-bold text-xs uppercase ${
                decision === 'approved' 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}>
                {decision === 'approved' ? '✓ Approved' : '✗ Rejected'}
              </span>
              <button 
                onClick={handleUndo}
                className="p-1 px-2.5 rounded border border-outline hover:bg-surface-container-high text-xs text-on-surface flex items-center gap-1 cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" /> Undo Selection
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main container content */}
      <div className="p-8 max-w-4xl mx-auto w-full space-y-8 flex-1">
        {/* State Banner Log */}
        {decision !== 'pending' && (
          <div className={`p-4 border rounded shadow-xs flex items-center gap-3 animate-fade-in ${
            decision === 'approved' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-bold text-sm">Action Status Declared</p>
              <p className="text-xs">
                {decision === 'approved' 
                  ? 'The automated agent pipeline was notified of human approval. Delivery date overridden to 15-May-2024.' 
                  : 'The request was canceled. A rejection notification with manual appeal form has been automatically dispatched back to supplier@aeroparts.com.'
                }
              </p>
            </div>
          </div>
        )}

        {/* Change Card */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-sm">
          <h3 className="text-title-md font-title-md text-on-surface mb-4 flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-primary" />
            AI Suggested Change
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-outline-variant border border-outline-variant rounded overflow-hidden font-code-md text-code-md">
            {/* Old state */}
            <div className="bg-[#fef2f2] p-4 flex flex-col">
              <span className="text-[11px] font-semibold text-error/80 mb-2 uppercase tracking-wider">
                Current SAP Date (Old)
              </span>
              <div className="flex items-center gap-2 text-error font-bold text-body-lg">
                <span className="text-lg font-black leading-none">-</span>
                <span>10-May-2024</span>
              </div>
            </div>

            {/* Proposed state */}
            <div className="bg-[#f0fdf4] p-4 flex flex-col">
              <span className="text-[11px] font-semibold text-[#166534]/80 mb-2 uppercase tracking-wider">
                Proposed Update (New)
              </span>
              <div className="flex items-center gap-2 text-[#166534] font-bold text-body-lg">
                <span className="text-lg font-black leading-none">+</span>
                <span>15-May-2024</span>
              </div>
            </div>
          </div>
        </div>

        {/* Email Extraction Context */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden shadow-sm">
          <div className="bg-surface-container-low px-4 py-2 border-b border-outline-variant flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-on-surface-variant" />
              <span className="font-label-md text-label-md text-on-surface-variant font-semibold">
                Source Extract: Email correspondence from supplier@aeroparts.com
              </span>
            </div>
            <span className="text-[10px] text-on-surface-variant/80 font-mono font-bold">DIGITAL_ID: 94819_SAP</span>
          </div>
          
          <div className="p-6 font-code-md text-code-md text-on-surface-variant whitespace-pre-wrap leading-relaxed bg-[#ffffff]">
            {"\"...Due to unexpected material shortages on the alloy casing, we regret to inform you that we cannot meet the original delivery date of 10-May. \n\nWe anticipate completing the final testing by 13-May and can expedite shipping to arrive at your facility by "}
            <span className="bg-[#fef08a] text-on-surface px-1 rounded font-bold border border-[#f59e0b]/20">
              15-May
            </span>
            {". Please advise if this requires further discussion...\""}
          </div>
        </div>
      </div>
    </div>
  );
}
