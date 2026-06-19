import React, { useState, useEffect } from 'react';
import { Check, X, ShieldAlert, Undo2, History, FileText, Wrench, Archive } from 'lucide-react';
import { ValidationTask } from '../types';
import { fetchWithAuth } from '../api';

interface TraceabilityViewProps {
  onStatusChange?: (statusMessage: string, success: boolean) => void;
  activeTask?: ValidationTask;
}

export default function TraceabilityView({ onStatusChange, activeTask }: TraceabilityViewProps) {
  const [decision, setDecision] = useState<'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    setDecision(activeTask?.status === 'EXECUTED' ? 'approved' : activeTask?.status === 'REJECTED' ? 'rejected' : 'pending');
  }, [activeTask?.id]);

  const payload = activeTask?.payload || {};
  const serialNumber = payload.serial_number || 'N/A';
  const poNumber = payload.po_number || 'Not found in datalake';
  const partReference = payload.part_reference || 'N/A';
  const supplierName = payload.supplier_name || 'Unknown supplier';
  const receptionDate = payload.reception_date || 'N/A';
  const defects: string[] = payload.defects || [];
  const sources: string[] = payload.sources || [];
  const narrative = payload.narrative || 'No narrative was compiled.';

  const handleApprove = async () => {
    if (!activeTask) return;
    try {
      await fetchWithAuth(`/tasks/${activeTask.id}/approve`, { method: 'POST' });
      setDecision('approved');
      onStatusChange?.(`Traceability dossier ${serialNumber} archived.`, true);
    } catch (err: any) {
      onStatusChange?.(`Archiving failed: ${err.message}`, false);
    }
  };

  const handleReject = async () => {
    if (!activeTask) return;
    try {
      await fetchWithAuth(`/tasks/${activeTask.id}/reject`, { method: 'POST' });
      setDecision('rejected');
      onStatusChange?.(`Dossier ${serialNumber} rejected. Nothing was archived.`, true);
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
              {serialNumber}
            </span>
            <span className="text-label-md font-label-md text-on-surface-variant font-medium">
              End-to-End Traceability (M5)
            </span>
          </div>
          <h2 className="text-headline-md font-headline-md text-on-surface">
            Hybrid Traceability Dossier
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
                <Archive className="w-4 h-4 text-white" /> Archive Audit Dossier
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded font-bold text-xs uppercase ${
                decision === 'approved'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}>
                {decision === 'approved' ? '✓ Archived' : '✗ Rejected'}
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

      <div className="p-8 max-w-4xl mx-auto w-full space-y-8 flex-1 overflow-y-auto">
        {decision !== 'pending' && (
          <div className={`p-4 border rounded shadow-xs flex items-center gap-3 animate-fade-in ${
            decision === 'approved'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <p className="text-xs">
              {decision === 'approved'
                ? `Audit dossier for ${serialNumber} archived in the compliance log.`
                : `The dossier for ${serialNumber} was rejected. Nothing was archived.`}
            </p>
          </div>
        )}

        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-sm">
          <h3 className="text-title-md font-title-md text-on-surface mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Structured trail (Transactional agent — SQL)
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
            <div className="bg-surface p-4 flex flex-col">
              <span className="text-[11px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Reception Date</span>
              <span className="font-bold text-on-surface">{receptionDate}</span>
            </div>
            <div className={`p-4 flex flex-col col-span-2 ${defects.length > 0 ? 'bg-[#fef2f2]' : 'bg-surface'}`}>
              <span className={`text-[11px] font-semibold mb-1 uppercase tracking-wider ${defects.length > 0 ? 'text-error/80' : 'text-on-surface-variant'}`}>
                Quality Notifications (FNC)
              </span>
              {defects.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-1">
                  {defects.map((d, i) => (
                    <span key={i} className="font-bold text-error flex items-center gap-1.5 bg-white/60 px-2 py-1 rounded border border-error/20 text-xs">
                      <Wrench className="w-3.5 h-3.5" /> {d}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="font-bold text-on-surface">None on record</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden shadow-sm">
          <div className="bg-surface-container-low px-4 py-2 border-b border-outline-variant">
            <span className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Compiled narrative
            </span>
          </div>
          <div className="p-6 font-code-md text-code-md text-on-surface whitespace-pre-wrap leading-relaxed bg-[#ffffff]">
            {narrative}
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-sm">
          <h3 className="text-title-md font-title-md text-on-surface mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Documents retrieved (Investigative agent — RAG)
          </h3>
          {sources.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {sources.map((src, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-surface-container text-on-surface-variant text-[11px] font-code-md rounded-full border border-outline-variant"
                >
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span>Source: {src}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-on-surface-variant">No matching documents were found in Qdrant.</p>
          )}
        </div>
      </div>
    </div>
  );
}
