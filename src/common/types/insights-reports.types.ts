/**
 * Types de Insights & Reports - Sprint 9
 * Interfaces para as 16 tabelas do módulo de analytics, insights e relatórios
 */

import {
  AuditFields,
  SoftDeleteFields,
  AIContextFields,
} from './academic.types';

// ============================================
// Enums / Status Types
// ============================================

export type MetricKind =
  | 'number'
  | 'percentage'
  | 'count'
  | 'duration'
  | 'currency'
  | 'text';

export type MetricValueType = 'numeric' | 'integer' | 'text' | 'jsonb';

export type MetricAggregation =
  | 'mean'
  | 'sum'
  | 'count'
  | 'min'
  | 'max'
  | 'median'
  | 'p50'
  | 'p75'
  | 'p90';

export type MetricVisibility = 'internal' | 'guardian' | 'public';

export type MetricTargetKind =
  | 'student'
  | 'enrollment'
  | 'class_group'
  | 'grade_level'
  | 'school';

export type CohortKind = 'class_group' | 'grade_level' | 'school';

export type QualityStatus =
  | 'ok'
  | 'estimated'
  | 'partial'
  | 'missing'
  | 'invalid';

export type AnalyticsJobType =
  | 'compute_metrics'
  | 'compute_cohort_stats'
  | 'generate_insights'
  | 'generate_reports'
  | 'compute_leaderboards';

export type AnalyticsJobStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled';

export type InsightCategory =
  | 'academic'
  | 'attendance'
  | 'behavior'
  | 'engagement'
  | 'risk'
  | 'achievement'
  | 'custom';

export type InsightSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type InsightTargetKind =
  | 'student'
  | 'class_group'
  | 'grade_level'
  | 'school';

export type InsightPublishPolicy =
  | 'internal_only'
  | 'guardian_allowed'
  | 'guardian_auto';

export type InsightInstanceStatus =
  | 'open'
  | 'reviewing'
  | 'approved'
  | 'dismissed'
  | 'resolved'
  | 'delivered';

export type InsightEventType =
  | 'created'
  | 'status_changed'
  | 'approved'
  | 'dismissed'
  | 'resolved'
  | 'delivered'
  | 'comment_added';

export type InsightEventActorType = 'user' | 'ai' | 'system';

export type InsightDeliveryChannel =
  | 'email'
  | 'push'
  | 'sms'
  | 'whatsapp'
  | 'in_app';

export type InsightDeliveryStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'read';

export type ReportOutputFormat = 'markdown' | 'pdf' | 'html' | 'json';

export type ReportRunStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled';

export type ReportFeedbackType =
  | 'quality'
  | 'accuracy'
  | 'usefulness'
  | 'other';

export type LeaderboardScope = 'school' | 'grade_level' | 'class_group';

export type SortDirection = 'asc' | 'desc';

// ============================================
// Metric Definitions
// ============================================

export interface MetricDefinition
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  key: string;
  name: string;
  description: string | null;
  metric_kind: MetricKind;
  value_type: MetricValueType;
  unit: string | null;
  aggregation_default: MetricAggregation | null;
  dimensions: Record<string, unknown>;
  source_tables: string[];
  source_definition: Record<string, unknown>;
  visibility: MetricVisibility;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

// ============================================
// Metric Values
// ============================================

export interface MetricValue
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  metric_definition_id: string;
  academic_year_id: string;
  grading_period_id: string | null;
  as_of_date: string | null;
  target_kind: MetricTargetKind;
  student_id: string | null;
  enrollment_id: string | null;
  class_group_id: string | null;
  grade_level_id: string | null;
  subject_id: string | null;
  target_key: string;
  period_key: string;
  dimension_key: string;
  value_numeric: number | null;
  value_integer: number | null;
  value_text: string | null;
  value_json: Record<string, unknown>;
  sample_size: number | null;
  quality_status: QualityStatus;
  computed_at: string | null;
  computed_by: string | null;
  computed_from: Record<string, unknown>;
  notes: string | null;
  metadata: Record<string, unknown>;
}

// ============================================
// Cohort Metric Stats
// ============================================

export interface CohortMetricStats extends AuditFields, SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  metric_definition_id: string;
  academic_year_id: string;
  grading_period_id: string | null;
  as_of_date: string | null;
  cohort_kind: CohortKind;
  class_group_id: string | null;
  grade_level_id: string | null;
  subject_id: string | null;
  cohort_key: string;
  period_key: string;
  dimension_key: string;
  n: number;
  mean: number | null;
  median: number | null;
  stddev: number | null;
  min: number | null;
  max: number | null;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  quality_status: QualityStatus;
  computed_at: string | null;
  computed_by: string | null;
  computed_from: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

// ============================================
// Analytics Job Runs
// ============================================

export interface AnalyticsJobRun {
  id: string;
  tenant_id: string;
  school_id: string | null;
  job_type: AnalyticsJobType;
  status: AnalyticsJobStatus;
  scheduled_for: string | null;
  started_at: string | null;
  finished_at: string | null;
  academic_year_id: string | null;
  grading_period_id: string | null;
  scope: Record<string, unknown>;
  stats: Record<string, unknown>;
  triggered_by: string | null;
  agent_id: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================
// Insight Definitions
// ============================================

export interface InsightDefinition
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  key: string;
  name: string;
  description: string | null;
  category: InsightCategory;
  severity: InsightSeverity;
  target_kind: InsightTargetKind;
  metric_definition_id: string | null;
  rule: Record<string, unknown>;
  recommended_actions: unknown[];
  publish_policy: InsightPublishPolicy;
  requires_consent: boolean;
  consent_type: string;
  min_cohort_size: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

// ============================================
// Insight Instances
// ============================================

export interface InsightInstance
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  insight_definition_id: string;
  status: InsightInstanceStatus;
  target_kind: MetricTargetKind;
  student_id: string | null;
  enrollment_id: string | null;
  class_group_id: string | null;
  grade_level_id: string | null;
  academic_year_id: string;
  grading_period_id: string | null;
  detected_at: string;
  title: string | null;
  summary: string | null;
  details: Record<string, unknown>;
  ai_generated: boolean;
  ai_model: string | null;
  approved_at: string | null;
  approved_by: string | null;
  dismissed_at: string | null;
  dismissed_by: string | null;
  dismiss_reason: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  rag_document_id: string | null;
  related_report_run_id: string | null;
  metadata: Record<string, unknown>;
}

// ============================================
// Insight Events
// ============================================

export interface InsightEvent {
  id: string;
  tenant_id: string;
  insight_instance_id: string;
  event_type: InsightEventType;
  occurred_at: string;
  actor_type: InsightEventActorType;
  actor_id: string | null;
  old_status: InsightInstanceStatus | null;
  new_status: InsightInstanceStatus | null;
  comment: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================
// Insight Deliveries
// ============================================

export interface InsightDelivery {
  id: string;
  tenant_id: string;
  insight_instance_id: string;
  channel: InsightDeliveryChannel;
  recipient_id: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  status: InsightDeliveryStatus;
  scheduled_for: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

// ============================================
// Report Templates
// ============================================

export interface ReportTemplate extends AuditFields, SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  key: string;
  name: string;
  description: string | null;
  target_kind: MetricTargetKind;
  output_format: ReportOutputFormat;
  default_language: string;
  sections: unknown[];
  prompt: Record<string, unknown>;
  data_requirements: Record<string, unknown>;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

// ============================================
// Report Template Versions
// ============================================

export interface ReportTemplateVersion {
  id: string;
  tenant_id: string;
  report_template_id: string;
  version: number;
  snapshot_sections: unknown[];
  snapshot_prompt: Record<string, unknown>;
  snapshot_data_requirements: Record<string, unknown>;
  is_current: boolean;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

// ============================================
// Report Runs
// ============================================

export interface ReportRun
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  report_template_version_id: string;
  status: ReportRunStatus;
  target_kind: MetricTargetKind;
  student_id: string | null;
  enrollment_id: string | null;
  class_group_id: string | null;
  grade_level_id: string | null;
  academic_year_id: string;
  grading_period_id: string | null;
  requested_by: string | null;
  agent_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  report_title: string | null;
  report_summary: string | null;
  report_data: Record<string, unknown>;
  output_format: ReportOutputFormat;
  rag_document_id: string | null;
  content_hash: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

// ============================================
// Report Deliveries
// ============================================

export interface ReportDelivery {
  id: string;
  tenant_id: string;
  report_run_id: string;
  channel: InsightDeliveryChannel;
  recipient_id: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  status: InsightDeliveryStatus;
  scheduled_for: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

// ============================================
// Report Feedback
// ============================================

export interface ReportFeedback {
  id: string;
  tenant_id: string;
  report_run_id: string;
  user_id: string | null;
  guardian_id: string | null;
  feedback_type: ReportFeedbackType;
  rating: number | null;
  comment: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================
// Leaderboard Definitions
// ============================================

export interface LeaderboardDefinition extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  key: string;
  name: string;
  description: string | null;
  scope: LeaderboardScope;
  grade_level_id: string | null;
  class_group_id: string | null;
  academic_year_id: string;
  grading_period_id: string | null;
  metric_definition_id: string;
  subject_id: string | null;
  sort_direction: SortDirection;
  top_n: number;
  min_cohort_size: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

// ============================================
// Leaderboard Snapshots
// ============================================

export interface LeaderboardSnapshot {
  id: string;
  tenant_id: string;
  leaderboard_definition_id: string;
  computed_at: string;
  as_of_date: string | null;
  entries_count: number;
  cohort_size: number;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

// ============================================
// Leaderboard Entries
// ============================================

export interface LeaderboardEntry {
  id: string;
  tenant_id: string;
  leaderboard_snapshot_id: string;
  rank: number;
  student_id: string;
  enrollment_id: string | null;
  value_numeric: number | null;
  value_display: string | null;
  change_since_previous: number | null;
  previous_rank: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
