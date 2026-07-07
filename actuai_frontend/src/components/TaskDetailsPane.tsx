import React from 'react';
import { ViewType, ValidationTask } from '../types';
import SapUpdateView from './SapUpdateView';
import AogAlertView from './AogAlertView';
import RagSynthesisView from './RagSynthesisView';
import FncCreationView from './FncCreationView';
import TraceabilityView from './TraceabilityView';
import { Inbox } from 'lucide-react';

interface TaskDetailsPaneProps {
  activeViewId: ViewType;
  activeTask?: ValidationTask;
  onStatusChange: (statusMessage: string, success: boolean) => void;
}

export default function TaskDetailsPane({
  activeViewId,
  activeTask,
  onStatusChange
}: TaskDetailsPaneProps) {
  return (
    <div className="flex-1 bg-surface-bright flex flex-col h-full relative overflow-hidden">
      {/* Dynamic details switch */}
      {(() => {
        switch (activeViewId) {
          case 'sap':
            return <SapUpdateView onStatusChange={onStatusChange} activeTask={activeTask} />;
          case 'aog':
            return <AogAlertView onStatusChange={onStatusChange} activeTask={activeTask} />;
          case 'rag':
            return <RagSynthesisView onStatusChange={onStatusChange} activeTask={activeTask} />;
          case 'fnc':
            return <FncCreationView onStatusChange={onStatusChange} activeTask={activeTask} />;
          case 'traceability':
            return <TraceabilityView onStatusChange={onStatusChange} activeTask={activeTask} />;
          default:
            return (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-on-surface-variant font-sans">
                <Inbox className="w-12 h-12 opacity-40 mb-3" />
                <h3 className="font-semibold text-body-lg text-on-surface">No Item Loaded</h3>
                <p className="text-xs mt-1">Select a validation task from the inbox to begin.</p>
              </div>
            );
        }
      })()}
    </div>
  );
}
