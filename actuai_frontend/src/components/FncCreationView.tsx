import React from 'react';
import { ClipboardList, Wrench, Check } from 'lucide-react';
import { ValidationTask } from '../types';
import { ActionBar, DecisionBanner, useDecision } from './shared/ActionBar';

interface FncCreationViewProps {
  onStatusChange?: (statusMessage: string, success: boolean) => void;
  activeTask?: ValidationTask;
}

export default function FncCreationView({ onStatusChange, activeTask }: FncCreationViewProps) {
  const [decision, setDecision] = useDecision(activeTask);

  const payload = activeTask?.payload || {};
  const ncrNumber = payload.ncr_number || 'N/A';
  const poNumber = payload.po_number || 'N/A';
  const partReference = payload.part_reference || 'N/A';
  const supplierName = payload.supplier_name || 'Unknown supplier';
  const defectType = payload.defect_type || 'Unspecified defect';
  const sourceRequest = payload.source_request || activeTask?.summary || '';

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto">
      <div className="p-6 border-b border-outline-variant bg-surface-container-lowest flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-label-md font-label-md text-on-primary-container bg-primary-container px-2.5 py-1 rounded font-mono font-bold">
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

        <ActionBar
          task={activeTask}
          decision={decision}
          setDecision={setDecision}
          onStatusChange={onStatusChange}
          approveLabel="Submit to SAP"
          approveIcon={<Check className="w-4 h-4" />}
          approvedPill="✓ Submitted"
          approveSuccessMsg={`FNC ${ncrNumber} submitted to SAP for ${poNumber}. Track its 8D lifecycle in the Quality tab.`}
          rejectSuccessMsg={`FNC draft ${ncrNumber} rejected. Nothing was sent to SAP.`}
        />
      </div>

      <div className="p-6 md:p-8 max-w-4xl mx-auto w-full space-y-8 flex-1">
        <DecisionBanner
          decision={decision}
          approvedText={`SAP write-back executed: FNC ${ncrNumber} created for ${poNumber}.`}
          rejectedText={`The FNC draft ${ncrNumber} was rejected. No change was pushed to SAP.`}
        />

        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-sm">
          <h3 className="text-title-md font-title-md text-on-surface mb-4 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Pre-filled from the datalake
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
            <div className="bg-status-urgent-bg p-4 flex flex-col">
              <span className="text-[11px] font-semibold text-status-urgent/80 mb-1 uppercase tracking-wider">Defect Type</span>
              <span className="font-bold text-status-urgent flex items-center gap-1.5">
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
            <div className="p-6 font-code-md text-code-md text-on-surface-variant whitespace-pre-wrap leading-relaxed">
              {sourceRequest}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
