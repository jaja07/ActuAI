import React from 'react';
import { Clock, Filter, AlertTriangle } from 'lucide-react';
import { InboxItem, ViewType } from '../types';

interface InboxListProps {
  items: InboxItem[];
  activeItemId: string | null;
  onItemSelect: (item: InboxItem) => void;
  searchQuery: string;
}

export default function InboxList({
  items,
  activeItemId,
  onItemSelect,
  searchQuery
}: InboxListProps) {
  // Filter items dynamically based on search string
  const filteredItems = items.filter(item => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      item.code.toLowerCase().includes(query) ||
      item.title.toLowerCase().includes(query) ||
      item.summary.toLowerCase().includes(query)
    );
  });

  return (
    <div className="w-full md:w-1/3 min-w-[320px] max-w-[400px] border-r border-outline-variant bg-surface flex flex-col h-full flex-shrink-0">
      {/* List Header */}
      <div className="p-4 border-b border-outline-variant bg-surface-container-lowest sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h1 className="text-title-md font-title-md text-on-surface">Inbox Items</h1>
          <span className="text-[11px] bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full font-bold">
            {filteredItems.length}
          </span>
        </div>
        <button 
          title="Filter configuration" 
          className="text-on-surface-variant p-1.5 rounded hover:bg-surface-container transition-colors cursor-pointer"
        >
          <Filter className="w-4 h-4 text-on-surface" />
        </button>
      </div>

      {/* Scrollable Tasks container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" id="master-list">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant flex flex-col items-center justify-center gap-2">
            <p className="font-semibold text-body-lg">No Items Found</p>
            <p className="text-xs text-[#76777d]">Try refining your search query in the toolbar above.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isActive = activeItemId === item.id;
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => onItemSelect(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onItemSelect(item);
                  }
                }}
                className={`text-left bg-surface-container-lowest rounded-DEFAULT p-4 cursor-pointer relative transition-all shadow-xs block ${
                  isActive
                    ? 'border-2 border-primary ring-2 ring-primary/10'
                    : 'border border-outline-variant hover:bg-surface-container-lowest/70'
                }`}
              >
                <div className="flex justify-between items-start mb-2 gap-2">
                  <span className={`text-label-md font-label-md font-bold uppercase tracking-wider ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {item.code}
                  </span>
                  
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-label-md font-bold uppercase tracking-wider ${item.statusBg} ${item.statusColor}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${item.statusDot} ${item.viewId === 'aog' ? 'animate-pulse' : ''}`} />
                    {item.status}
                  </span>
                </div>

                <h3 className="text-body-lg font-body-lg text-on-surface font-semibold mb-1">
                  {item.title}
                </h3>
                
                <p className="text-code-md font-code-md text-on-surface-variant line-clamp-2 leading-relaxed">
                  {item.summary}
                </p>

                <div className="mt-3 flex gap-2 text-[10px] text-on-surface-variant items-center">
                  <Clock className="w-3.5 h-3.5 text-on-surface-variant" />
                  <span>{item.time}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
