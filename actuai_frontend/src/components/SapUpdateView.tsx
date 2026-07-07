import React from 'react';
import { Mail, GitCompare } from 'lucide-react';
import { ValidationTask } from '../types';
import { ActionBar, DecisionBanner, useDecision } from './shared/ActionBar';

interface SapUpdateViewProps {
  onStatusChange?: (statusMessage: string, success: boolean) => void;
  activeTask?: ValidationTask;
}

export default function SapUpdateView({ onStatusChange, activeTask }: SapUpdateViewProps) {
  const [decision, setDecision] = useDecision(activeTask);

  const payload = activeTask?.payload || {};
  const poNumber = payload.po_number || 'N/A';
  const supplierName = payload.supplier_name || 'Unknown supplier';
  const currentDate = payload.current_expected_date || '—';
  const newDate = payload.new_expected_date || '—';
  const sourceEmail = payload.source_email || activeTask?.summary || 'No source extract available.';

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto">
      {/* Detail Header area */}
      <div className="p-6 border-b border-outline-variant bg-surface-container-lowest flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-label-md font-label-md text-on-primary-container bg-primary-container px-2.5 py-1 rounded font-mono font-bold">
              {poNumber}
            </span>
            <span className="text-label-md font-label-md text-on-surface-variant font-medium">
              {supplierName}
            </span>
          </div>
          <h2 className="text-headline-md font-headline-md text-on-surface">
            SAP Date Update Request
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
          approveLabel="Approve"
          approveSuccessMsg={`SAP update approved: ${poNumber} delivery date set to ${newDate}. Delivery record updated in the datalake.`}
          rejectSuccessMsg={`SAP update for ${poNumber} rejected. Nothing was pushed to SAP.`}
        />
      </div>

      {/* Main container content */}
      <div className="p-6 md:p-8 max-w-4xl mx-auto w-full space-y-8 flex-1">
        <DecisionBanner
          decision={decision}
          approvedText={`SAP write-back executed: ${poNumber} delivery date updated to ${newDate}.`}
          rejectedText={`The draft for ${poNumber} was rejected. No change was pushed to SAP.`}
        />

        {/* Change Card */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-sm">
          <h3 className="text-title-md font-title-md text-on-surface mb-4 flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-primary" />
            AI Suggested Change
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-outline-variant border border-outline-variant rounded overflow-hidden font-code-md text-code-md">
            {/* Old state */}
            <div className="bg-status-urgent-bg p-4 flex flex-col">
              <span className="text-[11px] font-semibold text-status-urgent/80 mb-2 uppercase tracking-wider">
                Current SAP Date (Old)
              </span>
              <div className="flex items-center gap-2 text-status-urgent font-bold text-body-lg">
                <span className="text-lg font-black leading-none">-</span>
                <span>{currentDate}</span>
              </div>
            </div>

            {/* Proposed state */}
            <div className="bg-status-success-bg p-4 flex flex-col">
              <span className="text-[11px] font-semibold text-status-success/80 mb-2 uppercase tracking-wider">
                Proposed Update (New)
              </span>
              <div className="flex items-center gap-2 text-status-success font-bold text-body-lg">
                <span className="text-lg font-black leading-none">+</span>
                <span>{newDate}</span>
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
                Source Extract: Ingested supplier email
              </span>
            </div>
            <span className="text-[10px] text-on-surface-variant/80 font-mono font-bold">TASK #{activeTask?.id ?? '—'}</span>
          </div>

          <div className="p-6 font-code-md text-code-md text-on-surface-variant whitespace-pre-wrap leading-relaxed bg-surface-container-lowest">
            {sourceEmail}
          </div>
        </div>
      </div>
    </div>
  );
}
