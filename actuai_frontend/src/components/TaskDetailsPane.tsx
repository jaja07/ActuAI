import React from 'react';
import { ViewType } from '../types';
import SapUpdateView from './SapUpdateView';
import AogAlertView from './AogAlertView';
import RagSynthesisView from './RagSynthesisView';
import { ShieldCheck, ServerCrash } from 'lucide-react';

interface TaskDetailsPaneProps {
  activeViewId: ViewType;
  onStatusChange: (statusMessage: string, success: boolean) => void;
}

export default function TaskDetailsPane({
  activeViewId,
  onStatusChange
}: TaskDetailsPaneProps) {
  return (
    <div className="flex-1 bg-surface-bright flex flex-col h-full relative overflow-hidden">
      {/* Dynamic details switch */}
      {(() => {
        switch (activeViewId) {
          case 'sap':
            return <SapUpdateView onStatusChange={onStatusChange} />;
          case 'aog':
            return <AogAlertView onStatusChange={onStatusChange} />;
          case 'rag':
            return <RagSynthesisView />;
          default:
            return (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-on-surface-variant font-sans">
                <ServerCrash className="w-12 h-12 text-[#76777d]/50 mb-3 animate-pulse" />
                <h3 className="font-semibold text-body-lg text-on-surface">No Item Loaded</h3>
                <p className="text-xs text-[#76777d] mt-1">Select a validation task from the inbox registry list to begin.</p>
              </div>
            );
        }
      })()}
    </div>
  );
}
