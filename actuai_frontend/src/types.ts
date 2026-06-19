export type ViewType = 'sap' | 'aog' | 'rag' | 'fnc' | 'traceability';

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
  statusColor: string;
  statusBg: string;
  statusDot: string;
  time: string;
  originalTask?: ValidationTask;
}
