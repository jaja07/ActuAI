import React, { useEffect, useMemo, useState } from 'react';
import { FileText, RefreshCw, DatabaseZap } from 'lucide-react';
import { IndexedDocument } from '../types';
import { fetchWithAuth } from '../api';
import StatusPill from './shared/StatusPill';

interface DocumentsViewProps {
  searchQuery: string;
}

/**
 * Mission 4 screen: the technical documents currently indexed in the vector
 * store, with the revision parsed at indexing time (version control).
 */
export default function DocumentsView({ searchQuery }: DocumentsViewProps) {
  const [documents, setDocuments] = useState<IndexedDocument[]>([]);
  const [indexed, setIndexed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchWithAuth('/documents');
      const data = await response.json();
      setIndexed(data.indexed);
      setDocuments(data.documents ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const visible = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return documents;
    return documents.filter(d =>
      d.source.toLowerCase().includes(query) || d.doc_type.toLowerCase().includes(query)
    );
  }, [documents, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-bright">
      <div className="p-6 border-b border-outline-variant bg-surface-container-lowest flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 text-primary" />
            <span className="text-label-md font-label-md text-on-surface-variant font-semibold uppercase">
              Documentation Control (M4)
            </span>
          </div>
          <h2 className="text-headline-md font-headline-md text-on-surface">Indexed Technical Documents</h2>
          <p className="text-body-md text-on-surface-variant mt-1">
            The RAG corpus in Qdrant, with the revision index parsed from each file at indexing time.
          </p>
        </div>
        <button
          onClick={fetchDocuments}
          className="self-start flex items-center gap-1.5 px-3 py-2 border border-outline-variant rounded text-xs font-medium hover:bg-surface-container transition-colors cursor-pointer text-on-surface"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error ? (
          <div className="p-8 text-center text-on-surface-variant">
            <p className="font-semibold text-error">Failed to load documents</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        ) : !indexed || visible.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant">
            <DatabaseZap className="w-10 h-10 mx-auto opacity-30 mb-3" />
            <p className="font-semibold">{indexed ? 'No documents match your search' : 'Vector store is empty'}</p>
            {!indexed && (
              <p className="text-xs mt-1 font-mono">
                Run the indexer: docker compose exec actuai-backend python -m etl.document_indexer
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visible.map(doc => (
              <div
                key={doc.source}
                className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-xs flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <StatusPill tone="info" label={`Rev ${doc.revision}`} />
                </div>
                <p className="text-body-md font-semibold text-on-surface break-all">{doc.source}</p>
                <p className="text-xs text-on-surface-variant">{doc.doc_type.replace(/_/g, ' ')}</p>
                {doc.indexed_at && (
                  <p className="text-[10px] text-on-surface-variant/80 font-mono mt-auto">
                    Indexed {new Date(doc.indexed_at).toLocaleString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
