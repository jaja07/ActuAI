import React from 'react';
import { History, FileText, Wrench, Archive } from 'lucide-react';
import { ValidationTask } from '../types';
import { ActionBar, DecisionBanner, useDecision } from './shared/ActionBar';

interface TraceabilityViewProps {
  onStatusChange?: (statusMessage: string, success: boolean) => void;
  activeTask?: ValidationTask;
}

export default function TraceabilityView({ onStatusChange, activeTask }: TraceabilityViewProps) {
  const [decision, setDecision] = useDecision(activeTask);

  const payload = activeTask?.payload || {};
  const serialNumber = payload.serial_number || 'N/A';
  const poNumber = payload.po_number || 'Not found in datalake';
  const partReference = payload.part_reference || 'N/A';
  const supplierName = payload.supplier_name || 'Unknown supplier';
  const receptionDate = payload.reception_date || 'N/A';
  const defects: string[] = payload.defects || [];
  const sources: string[] = payload.sources || [];
  const narrative = payload.narrative || 'No narrative was compiled.';

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto">
      <div className="p-6 border-b border-outline-variant bg-surface-container-lowest flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-label-md font-label-md text-on-primary-container bg-primary-container px-2.5 py-1 rounded font-mono font-bold">
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

        <ActionBar
          task={activeTask}
          decision={decision}
          setDecision={setDecision}
          onStatusChange={onStatusChange}
          approveLabel="Archive Audit Dossier"
          approveIcon={<Archive className="w-4 h-4" />}
          approvedPill="✓ Archived"
          approveSuccessMsg={`Traceability dossier ${serialNumber} archived in the compliance log.`}
          rejectSuccessMsg={`Dossier ${serialNumber} rejected. Nothing was archived.`}
        />
      </div>

      <div className="p-6 md:p-8 max-w-4xl mx-auto w-full space-y-8 flex-1">
        <DecisionBanner
          decision={decision}
          approvedText={`Audit dossier for ${serialNumber} archived in the compliance log.`}
          rejectedText={`The dossier for ${serialNumber} was rejected. Nothing was archived.`}
        />

        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-sm">
          <h3 className="text-title-md font-title-md text-on-surface mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Structured trail (Transactional agent — SQL)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-outline-variant border border-outline-variant rounded overflow-hidden font-code-md text-code-md">
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
            <div className={`p-4 flex flex-col sm:col-span-2 ${defects.length > 0 ? 'bg-status-urgent-bg' : 'bg-surface'}`}>
              <span className={`text-[11px] font-semibold mb-1 uppercase tracking-wider ${defects.length > 0 ? 'text-status-urgent/80' : 'text-on-surface-variant'}`}>
                Quality Notifications (FNC)
              </span>
              {defects.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-1">
                  {defects.map((d, i) => (
                    <span key={i} className="font-bold text-status-urgent flex items-center gap-1.5 bg-surface-container-lowest/60 px-2 py-1 rounded text-xs">
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
          <div className="p-6 font-code-md text-code-md text-on-surface whitespace-pre-wrap leading-relaxed">
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
