import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { SchoolsModule } from './schools/schools.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { InvitationsModule } from './invitations/invitations.module';
import { OwnersModule } from './owners/owners.module';
import { AgentsModule } from './agents/agents.module';
import { TagsModule } from './tags/tags.module';
import { SitesModule } from './sites/sites.module';
import { RagModule } from './ai-core/rag/rag.module';
import { EducaIAModule } from './ai-core/educa-ia/educa-ia.module';
import { AiCoreModule } from './ai-core/config/ai-core.module';
import { PersonsModule } from './persons/persons.module';
import { StudentsModule } from './students/students.module';
import { GradeLevelsModule } from './grade-levels/grade-levels.module';
import { ShiftsModule } from './shifts/shifts.module';
import { ClassroomsModule } from './classrooms/classrooms.module';
import { AcademicYearsModule } from './academic-years/academic-years.module';
import { ClassGroupsModule } from './class-groups/class-groups.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { TransfersModule } from './transfers/transfers.module';
import { StudentTimelineModule } from './student-timeline/student-timeline.module';
import { SubjectsModule } from './subjects/subjects.module';
import { StaffMembersModule } from './staff-members/staff-members.module';
import { TimeSlotsModule } from './time-slots/time-slots.module';
import { GradingPeriodsModule } from './grading-periods/grading-periods.module';
import { CurriculumModule } from './curriculum/curriculum.module';
import { ClassGroupSubjectsModule } from './class-group-subjects/class-group-subjects.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { AttendanceSessionsModule } from './attendance-sessions/attendance-sessions.module';
import { StudentSubjectResultsModule } from './student-subject-results/student-subject-results.module';
import { GuardiansModule } from './guardians/guardians.module';
import { FamiliesModule } from './families/families.module';
import { ConsentsModule } from './consents/consents.module';
import { AcademicRecordSnapshotsModule } from './academic-record-snapshots/academic-record-snapshots.module';
import { DataSharesModule } from './data-shares/data-shares.module';
import { SchoolDocumentTypesModule } from './school-document-types/school-document-types.module';
import { SchoolDocumentTemplatesModule } from './school-document-templates/school-document-templates.module';
import { SchoolDocumentsModule } from './school-documents/school-documents.module';
import { StudentDisciplinaryCasesModule } from './student-disciplinary-cases/student-disciplinary-cases.module';
import { CommunicationThreadsModule } from './communication-threads/communication-threads.module';
import { CommunicationAttachmentsModule } from './communication-attachments/communication-attachments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PushTokensModule } from './push-tokens/push-tokens.module';
import { BillingConfigModule } from './billing-config/billing-config.module';
import { SubscriptionPlansModule } from './subscription-plans/subscription-plans.module';
import { BillingCustomersModule } from './billing-customers/billing-customers.module';
import { TenantSubscriptionsModule } from './tenant-subscriptions/tenant-subscriptions.module';
import { BillingInvoicesModule } from './billing-invoices/billing-invoices.module';
import { UsageTrackingModule } from './usage-tracking/usage-tracking.module';
import { BillingWebhooksModule } from './billing-webhooks/billing-webhooks.module';
// Sprint 8 - Pré-Matrícula
import { PreEnrollmentFormTemplatesModule } from './pre-enrollment-form-templates/pre-enrollment-form-templates.module';
import { PreEnrollmentHouseholdsModule } from './pre-enrollment-households/pre-enrollment-households.module';
import { PreEnrollmentApplicationsModule } from './pre-enrollment-applications/pre-enrollment-applications.module';
import { PreEnrollmentPeopleModule } from './pre-enrollment-people/pre-enrollment-people.module';
import { PreEnrollmentRelationshipsModule } from './pre-enrollment-relationships/pre-enrollment-relationships.module';
import { PreEnrollmentAttachmentsModule } from './pre-enrollment-attachments/pre-enrollment-attachments.module';
import { PreEnrollmentConsentsModule } from './pre-enrollment-consents/pre-enrollment-consents.module';
import { PreEnrollmentReviewsModule } from './pre-enrollment-reviews/pre-enrollment-reviews.module';
import { PreEnrollmentEventsModule } from './pre-enrollment-events/pre-enrollment-events.module';
import { PreEnrollmentConversionsModule } from './pre-enrollment-conversions/pre-enrollment-conversions.module';
// Sprint 9 - Insights & Reports
import { MetricDefinitionsModule } from './metric-definitions/metric-definitions.module';
import { MetricValuesModule } from './metric-values/metric-values.module';
import { CohortMetricStatsModule } from './cohort-metric-stats/cohort-metric-stats.module';
import { AnalyticsJobRunsModule } from './analytics-job-runs/analytics-job-runs.module';
import { InsightDefinitionsModule } from './insight-definitions/insight-definitions.module';
import { InsightInstancesModule } from './insight-instances/insight-instances.module';
import { InsightEventsModule } from './insight-events/insight-events.module';
import { InsightDeliveriesModule } from './insight-deliveries/insight-deliveries.module';
import { ReportTemplatesModule } from './report-templates/report-templates.module';
import { ReportTemplateVersionsModule } from './report-template-versions/report-template-versions.module';
import { ReportRunsModule } from './report-runs/report-runs.module';
import { ReportDeliveriesModule } from './report-deliveries/report-deliveries.module';
import { ReportFeedbackModule } from './report-feedback/report-feedback.module';
import { LeaderboardDefinitionsModule } from './leaderboard-definitions/leaderboard-definitions.module';
import { LeaderboardSnapshotsModule } from './leaderboard-snapshots/leaderboard-snapshots.module';
import { LeaderboardEntriesModule } from './leaderboard-entries/leaderboard-entries.module';
// Sprint 10 - Calendário Escolar
import { CalendarEventTypesModule } from './calendar-event-types/calendar-event-types.module';
import { CalendarDayTypesModule } from './calendar-day-types/calendar-day-types.module';
import { CalendarBlueprintsModule } from './calendar-blueprints/calendar-blueprints.module';
import { AcademicCalendarsModule } from './academic-calendars/academic-calendars.module';
// Estrutura Acadêmica (Dashboard Otimizado)
import { AcademicStructureModule } from './academic-structure/academic-structure.module';
import { LoggerModule } from './common/logger/logger.module';
import { CacheModule } from './common/cache/cache.module';
import { ServicesModule } from './common/services/services.module';
import { LoggingInterceptor } from './common/logger/logger.interceptor';
import { TenantIdInterceptor } from './common/interceptors/tenant-id.interceptor';
import { TenantAccessGuard } from './auth/guards/tenant-access.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule,
    CacheModule,
    ServicesModule,
    SupabaseModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    SchoolsModule,
    PermissionsModule,
    RolesModule,
    InvitationsModule,
    OwnersModule,
    AgentsModule,
    TagsModule,
    SitesModule,
    RagModule,
    EducaIAModule,
    AiCoreModule,
    PersonsModule,
    StudentsModule,
    GradeLevelsModule,
    ShiftsModule,
    ClassroomsModule,
    AcademicYearsModule,
    ClassGroupsModule,
    EnrollmentsModule,
    TransfersModule,
    StudentTimelineModule,
    SubjectsModule,
    StaffMembersModule,
    TimeSlotsModule,
    GradingPeriodsModule,
    CurriculumModule,
    ClassGroupSubjectsModule,
    AssessmentsModule,
    AttendanceSessionsModule,
    StudentSubjectResultsModule,
    GuardiansModule,
    FamiliesModule,
    ConsentsModule,
    AcademicRecordSnapshotsModule,
    DataSharesModule,
    SchoolDocumentTypesModule,
    SchoolDocumentTemplatesModule,
    SchoolDocumentsModule,
    StudentDisciplinaryCasesModule,
    CommunicationThreadsModule,
    CommunicationAttachmentsModule,
    NotificationsModule,
    PushTokensModule,
    BillingConfigModule,
    SubscriptionPlansModule,
    BillingCustomersModule,
    TenantSubscriptionsModule,
    BillingInvoicesModule,
    UsageTrackingModule,
    BillingWebhooksModule,
    // Sprint 8 - Pré-Matrícula
    PreEnrollmentFormTemplatesModule,
    PreEnrollmentHouseholdsModule,
    PreEnrollmentApplicationsModule,
    PreEnrollmentPeopleModule,
    PreEnrollmentRelationshipsModule,
    PreEnrollmentAttachmentsModule,
    PreEnrollmentConsentsModule,
    PreEnrollmentReviewsModule,
    PreEnrollmentEventsModule,
    PreEnrollmentConversionsModule,
    // Sprint 9 - Insights & Reports
    MetricDefinitionsModule,
    MetricValuesModule,
    CohortMetricStatsModule,
    AnalyticsJobRunsModule,
    InsightDefinitionsModule,
    InsightInstancesModule,
    InsightEventsModule,
    InsightDeliveriesModule,
    ReportTemplatesModule,
    ReportTemplateVersionsModule,
    ReportRunsModule,
    ReportDeliveriesModule,
    ReportFeedbackModule,
    LeaderboardDefinitionsModule,
    LeaderboardSnapshotsModule,
    LeaderboardEntriesModule,
    // Sprint 10 - Calendário Escolar
    CalendarEventTypesModule,
    CalendarDayTypesModule,
    CalendarBlueprintsModule,
    AcademicCalendarsModule,
    // Estrutura Acadêmica (Dashboard Otimizado)
    AcademicStructureModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: TenantAccessGuard,
    },
  ],
})
export class AppModule {}
