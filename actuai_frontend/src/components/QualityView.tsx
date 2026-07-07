import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, ChevronRight, Loader2, RefreshCw, Check } from 'lucide-react';
import { Fnc } from '../types';
import { fetchWithAuth } from '../api';
import StatusPill, { StatusTone } from './shared/StatusPill';

// Must stay aligned with the backend (api/routers/quality.py).
const EIGHT_D_SEQUENCE = ['PENDING', 'D3_CONTAINMENT', 'D5_CORRECTIVE_ACTION', 'D8_CLOSED'];

const STEP_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  D3_CONTAINMENT: 'D3 Containment',
  D5_CORRECTIVE_ACTION: 'D5 Corrective Action',
  D8_CLOSED: 'D8 Closed',
  CLOSED: 'Closed (legacy)',
};

function isClosed(status: string): boolean {
  return status === 'D8_CLOSED' || status === 'CLOSED';
}

function statusTone(status: string): StatusTone {
  if (isClosed(status)) return 'success';
  if (status === 'PENDING') return 'pending';
  return 'info';
}

interface QualityViewProps {
  onNotify: (message: string, success: boolean) => void;
  searchQuery: string;
}

/**
 * Mission 3 screen: the FNC registry with its condensed 8D lifecycle.
 * Advancing a report writes to the mock SAP first (source of truth), then
 * refreshes the mirrored list.
 */
export default function QualityView({ onNotify, searchQuery }: QualityViewProps) {
  const [fncs, setFncs] = useState<Fnc[]>([]);
  const [loading, setLoading] = useState(false);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const fetchFncs = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth('/quality/fncs');
      setFncs(await response.json());
    } catch (err: any) {
      onNotify(`Failed to load FNCs: ${err.message}`, false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFncs();
  }, []);

  const handleAdvance = async (ncr: string) => {
    setAdvancing(ncr);
    try {
      const response = await fetchWithAuth(`/quality/fncs/${ncr}/advance`, { method: 'POST' });
      const result = await response.json();
      onNotify(`${ncr}: 8D advanced ${STEP_LABELS[result.previous_status] ?? result.previous_status} → ${STEP_LABELS[result.new_status] ?? result.new_status}.`, true);
      await fetchFncs();
    } catch (err: any) {
      onNotify(`8D advance failed: ${err.message}`, false);
    } finally {
      setAdvancing(null);
    }
  };

  const visible = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return fncs.filter(f => {
      if (statusFilter && f.report_8d_status !== statusFilter) return false;
      if (!query) return true;
      return (
        f.ncr_number.toLowerCase().includes(query) ||
        f.po_number.toLowerCase().includes(query) ||
        f.defect_type.toLowerCase().includes(query)
      );
    });
  }, [fncs, statusFilter, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-bright">
      {/* Header */}
      <div className="p-6 border-b border-outline-variant bg-surface-container-lowest flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="text-label-md font-label-md text-on-surface-variant font-semibold uppercase">
              Quality Management (M3)
            </span>
          </div>
          <h2 className="text-headline-md font-headline-md text-on-surface">Non-Conformance Reports — 8D Tracking</h2>
          <p className="text-body-md text-on-surface-variant mt-1">
            Advance each FNC through the condensed 8D lifecycle. Transitions are written to SAP and audit-logged.
          </p>
        </div>
        <button
          onClick={fetchFncs}
          className="self-start flex items-center gap-1.5 px-3 py-2 border border-outline-variant rounded text-xs font-medium hover:bg-surface-container transition-colors cursor-pointer text-on-surface"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Filter chips */}
      <div className="px-6 py-3 flex flex-wrap gap-2 border-b border-outline-variant bg-surface">
        <button
          onClick={() => setStatusFilter(null)}
          className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
            statusFilter === null
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          All ({fncs.length})
        </button>
        {EIGHT_D_SEQUENCE.map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(statusFilter === status ? null : status)}
            className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
              statusFilter === status
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {STEP_LABELS[status]} ({fncs.filter(f => f.report_8d_status === status).length})
          </button>
        ))}
      </div>

      {/* FNC list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {visible.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant">
            <ShieldCheck className="w-10 h-10 mx-auto opacity-30 mb-3" />
            <p className="font-semibold">No FNCs {statusFilter ? `in ${STEP_LABELS[statusFilter]}` : 'on record'}</p>
            <p className="text-xs mt-1">FNCs created from quality emails appear here after the next SAP sync.</p>
          </div>
        ) : (
          visible.map(fnc => {
            const closed = isClosed(fnc.report_8d_status);
            const stepIndex = closed
              ? EIGHT_D_SEQUENCE.length - 1
              : EIGHT_D_SEQUENCE.indexOf(fnc.report_8d_status);
            return (
              <div
                key={fnc.ncr_number}
                className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 shadow-xs"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-label-md font-label-md text-primary bg-primary-container px-2.5 py-1 rounded font-mono font-bold">
                      {fnc.ncr_number}
                    </span>
                    <span className="text-xs text-on-surface-variant font-mono">{fnc.po_number}</span>
                    <StatusPill tone={statusTone(fnc.report_8d_status)} label={STEP_LABELS[fnc.report_8d_status] ?? fnc.report_8d_status} />
                  </div>
                  <button
                    onClick={() => handleAdvance(fnc.ncr_number)}
                    disabled={closed || advancing !== null}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded font-label-md text-label-md font-semibold transition-opacity ${
                      closed
                        ? 'bg-status-success-bg text-status-success cursor-default'
                        : 'bg-primary text-on-primary hover:opacity-90 cursor-pointer disabled:opacity-60'
                    }`}
                  >
                    {closed ? (
                      <><Check className="w-4 h-4" /> Closed</>
                    ) : advancing === fnc.ncr_number ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Advancing…</>
                    ) : (
                      <>Advance to {STEP_LABELS[EIGHT_D_SEQUENCE[stepIndex + 1]] ?? 'next step'} <ChevronRight className="w-4 h-4" /></>
                    )}
                  </button>
                </div>

                <p className="text-body-md text-on-surface mb-4">
                  <span className="text-on-surface-variant">Defect:</span>{' '}
                  <span className="font-semibold">{fnc.defect_type}</span>
                </p>

                {/* 8D stepper */}
                <div className="flex items-center gap-0">
                  {EIGHT_D_SEQUENCE.map((step, i) => {
                    const reached = i <= stepIndex;
                    return (
                      <React.Fragment key={step}>
                        {i > 0 && (
                          <div className={`flex-1 h-0.5 ${i <= stepIndex ? 'bg-primary' : 'bg-outline-variant'}`} />
                        )}
                        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                              reached
                                ? 'bg-primary border-primary text-on-primary'
                                : 'bg-surface border-outline-variant text-on-surface-variant'
                            }`}
                          >
                            {reached ? <Check className="w-3 h-3" /> : i + 1}
                          </div>
                          <span className={`text-[9px] uppercase tracking-wide font-semibold text-center ${reached ? 'text-primary' : 'text-on-surface-variant'}`}>
                            {STEP_LABELS[step]}
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                <p className="text-[10px] text-on-surface-variant mt-3 font-mono">
                  Last synced: {new Date(fnc.synced_at).toLocaleString()}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
