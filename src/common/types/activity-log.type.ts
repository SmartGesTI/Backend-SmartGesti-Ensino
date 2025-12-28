export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  description: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}
