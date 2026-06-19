export type ViewType = 'sap' | 'aog' | 'rag';

export interface InboxItem {
  id: string;
  viewId: ViewType;
  code: string;
  title: string;
  summary: string;
  status: 'PENDING HUMAN REVIEW' | 'URGENT REVIEW' | 'DRAFT READY';
  statusColor: string;
  statusBg: string;
  statusDot: string;
  time: string;
}
