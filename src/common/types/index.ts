// User & Auth
export * from './user.type';
export * from './activity-log.type';
export * from './supabase-user.type';
export type { Tenant } from './tenant.type';
export type { School, SchoolMember } from './school.type';

// Academic Types (inclui todos os types de Sprint 1-6)
export * from './academic.types';

// Sprint 7 - Billing (arquivo separado)
export * from './billing.types';

// Sprint 8 - Pré-Matrícula (arquivo separado)
export * from './pre-enrollment.types';

// Sprint 9 - Insights & Reports (arquivo separado)
export * from './insights-reports.types';

// Sprint 10 - Calendário Escolar (arquivo separado)
export * from './calendar.types';

// Nota: Os arquivos abaixo são módulos separados para organização futura.
// Eles re-exportam tipos que também estão em academic.types.ts.
// Use imports diretos quando precisar apenas de um domínio específico:
// - import { Subject } from '../common/types/subject.types';
// - import { StaffMember } from '../common/types/staff.types';
// - import { Curriculum } from '../common/types/curriculum.types';
// - import { TimeSlot } from '../common/types/schedule.types';
// - import { Assessment } from '../common/types/grading.types';
// - import { AttendanceSession } from '../common/types/attendance.types';
