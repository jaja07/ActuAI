export type ViewType = 'sap' | 'aog' | 'rag' | 'fnc' | 'traceability';

/** Sidebar navigation tabs. inbox/aog/traceability filter the task inbox;
 *  quality and documents open dedicated screens. */
export type TabId = 'inbox' | 'aog' | 'quality' | 'traceability' | 'documents';

/** FNC row returned by GET /api/quality/fncs (Mission 3). */
export interface Fnc {
  id: number;
  ncr_number: string;
  po_number: string;
  defect_type: string;
  report_8d_status: string;
  synced_at: string;
}

/** Indexed document returned by GET /api/documents (Mission 4). */
export interface IndexedDocument {
  source: string;
  revision: string;
  doc_type: string;
  indexed_at?: string;
}

export type TaskStatusType = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED';

export interface TokenUser {
  username: string;
  role: string;
  clearance: string;
}

export interface ValidationTask {
  id: number;
  mission: string;
  agent: string;
  kind: string; // 'SAP_UPDATE' | 'EMAIL_REPLY' | etc
  summary: string;
  payload: any;
  status: TaskStatusType;
  created_at: string;
  decided_at?: string;
  decided_by?: string;
}

export interface InboxItem {
  id: string;
  viewId: ViewType;
  code: string;
  title: string;
  summary: string;
  status: string;
  statusTone: 'pending' | 'urgent';
  time: string;
  originalTask?: ValidationTask;
}
