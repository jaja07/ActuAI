import React, { useState } from 'react';
import { Check, X, ShieldAlert, Undo2, ClipboardList, Wrench } from 'lucide-react';
import { ValidationTask } from '../types';
import { fetchWithAuth } from '../api';

interface FncCreationViewProps {
  onStatusChange?: (statusMessage: string, success: boolean) => void;
  activeTask?: ValidationTask;
}

export default function FncCreationView({ onStatusChange, activeTask }: FncCreationViewProps) {
  const [decision, setDecision] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const payload = activeTask?.payload || {};
  const ncrNumber = payload.ncr_number || 'N/A';
  const poNumber = payload.po_number || 'N/A';
  const partReference = payload.part_reference || 'N/A';
  const supplierName = payload.supplier_name || 'Unknown supplier';
  const defectType = payload.defect_type || 'Unspecified defect';
  const sourceRequest = payload.source_request || activeTask?.summary || '';

  const handleApprove = async () => {
    if (!activeTask) return;
    try {
      await fetchWithAuth(`/tasks/${activeTask.id}/approve`, { method: 'POST' });
      setDecision('approved');
      onStatusChange?.(`FNC ${ncrNumber} submitted to SAP for ${poNumber}.`, true);
    } catch (err: any) {
      onStatusChange?.(`Submission failed: ${err.message}`, false);
    }
  };

  const handleReject = async () => {
    if (!activeTask) return;
    try {
      await fetchWithAuth(`/tasks/${activeTask.id}/reject`, { method: 'POST' });
      setDecision('rejected');
      onStatusChange?.(`FNC draft ${ncrNumber} rejected. Nothing was sent to SAP.`, true);
    } catch (err: any) {
      onStatusChange?.(`Rejection failed: ${err.message}`, false);
    }
  };

  const handleUndo = () => {
    setDecision('pending');
    onStatusChange?.('Decision resetting...', true);
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-6 border-b border-outline-variant bg-surface-container-lowest flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-label-md font-label-md text-primary bg-primary-container px-2.5 py-1 rounded font-mono font-bold">
              {ncrNumber}
            </span>
            <span className="text-label-md font-label-md text-on-surface-variant font-medium">
              Quality Management (M3)
            </span>
          </div>
          <h2 className="text-headline-md font-headline-md text-on-surface">
            Non-Conformance Report Draft
          </h2>
          {activeTask?.summary && (
            <p className="text-body-md text-on-surface-variant mt-1">{activeTask.summary}</p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {decision === 'pending' ? (
            <>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-error cursor-pointer text-on-error rounded-DEFAULT font-label-md text-label-md hover:bg-error/90 transition-colors flex items-center gap-2 shadow-sm font-semibold"
              >
                <X className="w-4 h-4 text-white" /> Reject
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-[#166534] cursor-pointer text-white rounded-DEFAULT font-label-md text-label-md hover:bg-[#15803d]/90 transition-colors flex items-center gap-2 shadow-sm font-semibold"
              >
                <Check className="w-4 h-4 text-white" /> Submit to SAP
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded font-bold text-xs uppercase ${
                decision === 'approved'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}>
                {decision === 'approved' ? '✓ Submitted' : '✗ Rejected'}
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

      <div className="p-8 max-w-4xl mx-auto w-full space-y-8 flex-1">
        {decision !== 'pending' && (
          <div className={`p-4 border rounded shadow-xs flex items-center gap-3 animate-fade-in ${
            decision === 'approved'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <p className="text-xs">
              {decision === 'approved'
                ? `SAP write-back executed: FNC ${ncrNumber} created for ${poNumber}.`
                : `The FNC draft ${ncrNumber} was rejected. No change was pushed to SAP.`}
            </p>
          </div>
        )}

        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-sm">
          <h3 className="text-title-md font-title-md text-on-surface mb-4 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Pre-filled from the datalake
          </h3>
          <div className="grid grid-cols-2 gap-px bg-outline-variant border border-outline-variant rounded overflow-hidden font-code-md text-code-md">
            <div className="bg-surface p-4 flex flex-col">
              <span className="text-[11px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Purchase Order</span>
              <span className="font-bold text-on-surface">{poNumber}</span>
            </div>
            <div className="bg-surface p-4 flex flex-col">
              <span className="text-[11px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Part Reference</span>
              <span className="font-bold text-on-surface">{partReference}</span>
            </div>
            <div className="bg-surface p-4 flex flex-col">
              <span className="text-[11px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Supplier</span>
              <span className="font-bold text-on-surface">{supplierName}</span>
            </div>
            <div className="bg-[#fef2f2] p-4 flex flex-col">
              <span className="text-[11px] font-semibold text-error/80 mb-1 uppercase tracking-wider">Defect Type</span>
              <span className="font-bold text-error flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" /> {defectType}
              </span>
            </div>
          </div>
        </div>

        {sourceRequest && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden shadow-sm">
            <div className="bg-surface-container-low px-4 py-2 border-b border-outline-variant">
              <span className="font-label-md text-label-md text-on-surface-variant font-semibold">
                Source request from the quality controller
              </span>
            </div>
            <div className="p-6 font-code-md text-code-md text-on-surface-variant whitespace-pre-wrap leading-relaxed bg-[#ffffff]">
              {sourceRequest}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
