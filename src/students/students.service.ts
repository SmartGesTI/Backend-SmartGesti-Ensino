import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { PersonsService } from '../persons/persons.service';
import {
  Student,
  StudentTenantProfile,
  StudentSchoolProfile,
  StudentWithProfiles,
  StudentGuardianLink,
  StudentGuardianLinkWithDetails,
  PaginatedResult,
} from '../common/types';
import {
  CreateStudentDto,
  CreateStudentFromPersonDto,
} from './dto/create-student.dto';
import {
  UpdateStudentTenantProfileDto,
  UpdateStudentSchoolProfileDto,
  AssociateStudentToSchoolDto,
} from './dto/update-student.dto';
import {
  CreateStudentGuardianLinkDto,
  UpdateStudentGuardianLinkDto,
} from './dto/create-student-guardian-link.dto';

@Injectable()
export class StudentsService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
    private personsService: PersonsService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  // ============================================
  // Students CRUD
  // ============================================

  async findAll(
    tenantId: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
    status?: string,
  ): Promise<PaginatedResult<StudentWithProfiles>> {
    const offset = (page - 1) * limit;

    // Buscar perfis de tenant com dados do student e person
    let query = this.supabase
      .from('student_tenant_profiles')
      .select(
        `
        *,
        students!inner (
          *,
          persons!inner (*)
        )
      `,
        { count: 'exact' },
      )
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      // Buscar por nome na tabela persons
      query = query.ilike('students.persons.full_name', `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(
        `Failed to list students: ${error.message}`,
        undefined,
        'StudentsService',
        { tenantId },
      );
      throw new Error(`Failed to list students: ${error.message}`);
    }

    // Mapear para o formato esperado
    const students: StudentWithProfiles[] = (data || []).map(
      (profile: any) => ({
        ...profile.students,
        person: profile.students.persons,
        tenant_profile: {
          id: profile.id,
          tenant_id: profile.tenant_id,
          student_id: profile.student_id,
          status: profile.status,
          tenant_registration_code: profile.tenant_registration_code,
          external_id: profile.external_id,
          notes: profile.notes,
          ai_context: profile.ai_context,
          ai_summary: profile.ai_summary,
          created_at: profile.created_at,
          updated_at: profile.updated_at,
          created_by: profile.created_by,
          updated_by: profile.updated_by,
          deleted_at: profile.deleted_at,
          deleted_by: profile.deleted_by,
        },
      }),
    );

    return {
      data: students,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<StudentWithProfiles | null> {
    // Buscar student com person
    const { data: student, error } = await this.supabase
      .from('students')
      .select(
        `
        *,
        persons!inner (*)
      `,
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !student) {
      if (error?.code === 'PGRST116') {
        return null;
      }
      return null;
    }

    // Buscar perfil do tenant
    const { data: tenantProfile } = await this.supabase
      .from('student_tenant_profiles')
      .select('*')
      .eq('student_id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    // Buscar perfis de escolas
    const { data: schoolProfiles } = await this.supabase
      .from('student_school_profiles')
      .select('*')
      .eq('student_id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    return {
      ...student,
      person: (student as any).persons,
      tenant_profile: tenantProfile as StudentTenantProfile,
      school_profiles: (schoolProfiles || []) as StudentSchoolProfile[],
    };
  }

  async create(
    tenantId: string,
    createStudentDto: CreateStudentDto,
    userId?: string,
  ): Promise<StudentWithProfiles> {
    // 1. Verificar se já existe pessoa com CPF
    if (createStudentDto.cpf) {
      const existingPerson = await this.personsService.findByDocument(
        'cpf',
        createStudentDto.cpf,
      );
      if (existingPerson) {
        // Verificar se já é aluno
        const { data: existingStudent } = await this.supabase
          .from('students')
          .select('id')
          .eq('person_id', existingPerson.id)
          .is('deleted_at', null)
          .single();

        if (existingStudent) {
          throw new ConflictException(
            `Já existe um aluno cadastrado com o CPF ${createStudentDto.cpf}`,
          );
        }
      }
    }

    // 2. Criar pessoa
    const person = await this.personsService.create(
      {
        full_name: createStudentDto.full_name,
        preferred_name: createStudentDto.preferred_name,
        birth_date: createStudentDto.birth_date,
        sex: createStudentDto.sex,
      },
      userId,
    );

    // 3. Adicionar CPF se fornecido
    if (createStudentDto.cpf) {
      await this.personsService.addDocument(
        person.id,
        {
          doc_type: 'cpf',
          doc_value: createStudentDto.cpf,
          is_primary: true,
        },
        userId,
      );
    }

    // 4. Criar student
    const { data: student, error: studentError } = await this.supabase
      .from('students')
      .insert({
        person_id: person.id,
        global_status: 'active',
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (studentError) {
      this.logger.error(
        `Failed to create student: ${studentError.message}`,
        undefined,
        'StudentsService',
      );
      throw new Error(`Failed to create student: ${studentError.message}`);
    }

    // 5. Criar perfil do tenant
    const { data: tenantProfile, error: profileError } = await this.supabase
      .from('student_tenant_profiles')
      .insert({
        tenant_id: tenantId,
        student_id: student.id,
        status: 'active',
        tenant_registration_code: createStudentDto.tenant_registration_code,
        external_id: createStudentDto.external_id,
        notes: createStudentDto.notes,
        ai_context: {},
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (profileError) {
      // Verificar duplicação de matrícula
      if (
        profileError.code === '23505' &&
        profileError.message.includes('registration_code')
      ) {
        throw new ConflictException(
          `Já existe um aluno com a matrícula ${createStudentDto.tenant_registration_code}`,
        );
      }
      this.logger.error(
        `Failed to create tenant profile: ${profileError.message}`,
        undefined,
        'StudentsService',
      );
      throw new Error(
        `Failed to create tenant profile: ${profileError.message}`,
      );
    }

    this.logger.log('Student created', 'StudentsService', {
      studentId: student.id,
      personId: person.id,
      tenantId,
    });

    return {
      ...student,
      person,
      tenant_profile: tenantProfile as StudentTenantProfile,
    };
  }

  async createFromPerson(
    tenantId: string,
    dto: CreateStudentFromPersonDto,
    userId?: string,
  ): Promise<StudentWithProfiles> {
    // Verificar se pessoa existe
    const person = await this.personsService.findOne(dto.person_id);
    if (!person) {
      throw new NotFoundException(
        `Pessoa com id '${dto.person_id}' não encontrada`,
      );
    }

    // Verificar se já é aluno
    const { data: existingStudent } = await this.supabase
      .from('students')
      .select('id')
      .eq('person_id', dto.person_id)
      .is('deleted_at', null)
      .single();

    let student: Student;

    if (existingStudent) {
      // Já é aluno, verificar se já tem perfil neste tenant
      const { data: existingProfile } = await this.supabase
        .from('student_tenant_profiles')
        .select('id')
        .eq('student_id', existingStudent.id)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .single();

      if (existingProfile) {
        throw new ConflictException(
          'Este aluno já está cadastrado nesta organização',
        );
      }

      student = existingStudent as Student;
    } else {
      // Criar student
      const { data: newStudent, error } = await this.supabase
        .from('students')
        .insert({
          person_id: dto.person_id,
          global_status: 'active',
          ...this.softDeleteService.getCreateAuditData(userId),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create student: ${error.message}`);
      }

      student = newStudent as Student;
    }

    // Criar perfil do tenant
    const { data: tenantProfile, error: profileError } = await this.supabase
      .from('student_tenant_profiles')
      .insert({
        tenant_id: tenantId,
        student_id: student.id,
        status: 'active',
        tenant_registration_code: dto.tenant_registration_code,
        external_id: dto.external_id,
        notes: dto.notes,
        ai_context: {},
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (profileError) {
      if (
        profileError.code === '23505' &&
        profileError.message.includes('registration_code')
      ) {
        throw new ConflictException(
          `Já existe um aluno com a matrícula ${dto.tenant_registration_code}`,
        );
      }
      throw new Error(
        `Failed to create tenant profile: ${profileError.message}`,
      );
    }

    return {
      ...student,
      person,
      tenant_profile: tenantProfile as StudentTenantProfile,
    };
  }

  async updateTenantProfile(
    studentId: string,
    tenantId: string,
    dto: UpdateStudentTenantProfileDto,
    userId?: string,
  ): Promise<StudentTenantProfile> {
    const { data: profile, error: findError } = await this.supabase
      .from('student_tenant_profiles')
      .select('*')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (findError || !profile) {
      throw new NotFoundException(
        'Perfil do aluno não encontrado nesta organização',
      );
    }

    const { data, error } = await this.supabase
      .from('student_tenant_profiles')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', profile.id)
      .select()
      .single();

    if (error) {
      if (
        error.code === '23505' &&
        error.message.includes('registration_code')
      ) {
        throw new ConflictException(
          `Já existe um aluno com a matrícula ${dto.tenant_registration_code}`,
        );
      }
      throw new Error(`Failed to update tenant profile: ${error.message}`);
    }

    return data as StudentTenantProfile;
  }

  async associateToSchool(
    studentId: string,
    tenantId: string,
    dto: AssociateStudentToSchoolDto,
    userId?: string,
  ): Promise<StudentSchoolProfile> {
    // Verificar se aluno tem perfil no tenant
    const { data: tenantProfile } = await this.supabase
      .from('student_tenant_profiles')
      .select('*')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (!tenantProfile) {
      throw new NotFoundException('Aluno não encontrado nesta organização');
    }

    // Verificar se escola pertence ao tenant
    const { data: school } = await this.supabase
      .from('schools')
      .select('id, tenant_id')
      .eq('id', dto.school_id)
      .single();

    if (!school || school.tenant_id !== tenantId) {
      throw new ForbiddenException('Escola não pertence a esta organização');
    }

    // Verificar se já existe perfil para esta escola
    const { data: existingProfile } = await this.supabase
      .from('student_school_profiles')
      .select('id')
      .eq('student_id', studentId)
      .eq('school_id', dto.school_id)
      .is('deleted_at', null)
      .single();

    if (existingProfile) {
      throw new ConflictException('Aluno já está associado a esta escola');
    }

    // Criar perfil da escola
    const { data, error } = await this.supabase
      .from('student_school_profiles')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id,
        student_id: studentId,
        school_registration_code: dto.school_registration_code,
        status: 'active',
        entered_at: new Date().toISOString().split('T')[0],
        ai_context: {},
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      if (
        error.code === '23505' &&
        error.message.includes('registration_code')
      ) {
        throw new ConflictException(
          `Já existe um aluno com a matrícula ${dto.school_registration_code} nesta escola`,
        );
      }
      throw new Error(
        `Failed to associate student to school: ${error.message}`,
      );
    }

    this.logger.log('Student associated to school', 'StudentsService', {
      studentId,
      schoolId: dto.school_id,
    });

    return data as StudentSchoolProfile;
  }

  async updateSchoolProfile(
    studentId: string,
    schoolId: string,
    tenantId: string,
    dto: UpdateStudentSchoolProfileDto,
    userId?: string,
  ): Promise<StudentSchoolProfile> {
    const { data: profile, error: findError } = await this.supabase
      .from('student_school_profiles')
      .select('*')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (findError || !profile) {
      throw new NotFoundException(
        'Perfil do aluno não encontrado nesta escola',
      );
    }

    const { data, error } = await this.supabase
      .from('student_school_profiles')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', profile.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update school profile: ${error.message}`);
    }

    return data as StudentSchoolProfile;
  }

  async remove(
    studentId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const student = await this.findOne(studentId, tenantId);
    if (!student) {
      throw new NotFoundException('Aluno não encontrado');
    }

    // Soft-delete do perfil do tenant (não do student global)
    await this.supabase
      .from('student_tenant_profiles')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    // Soft-delete dos perfis de escolas deste tenant
    await this.supabase
      .from('student_school_profiles')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    this.logger.log('Student removed from tenant', 'StudentsService', {
      studentId,
      tenantId,
    });
  }

  // ============================================
  // Student Guardian Links
  // ============================================

  async findGuardians(
    studentId: string,
    tenantId: string,
  ): Promise<StudentGuardianLinkWithDetails[]> {
    const { data, error } = await this.supabase
      .from('student_guardian_links')
      .select(
        `
        *,
        guardians(*, persons(*))
      `,
      )
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('contact_priority', { ascending: true });

    if (error) {
      this.logger.error(
        `Failed to list student guardians: ${error.message}`,
        undefined,
        'StudentsService',
      );
      throw new Error(`Failed to list student guardians: ${error.message}`);
    }

    return (data || []).map((item: any) => ({
      ...item,
      guardian: {
        ...item.guardians,
        person: item.guardians?.persons,
      },
    })) as StudentGuardianLinkWithDetails[];
  }

  async addGuardian(
    studentId: string,
    tenantId: string,
    dto: CreateStudentGuardianLinkDto,
    userId?: string,
  ): Promise<StudentGuardianLink> {
    // Verificar se já existe vínculo
    const { data: existingLink } = await this.supabase
      .from('student_guardian_links')
      .select('id')
      .eq('student_id', studentId)
      .eq('guardian_id', dto.guardian_id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (existingLink) {
      throw new ConflictException(
        'Este responsável já está vinculado a este aluno',
      );
    }

    // Se is_primary_contact = true, remover primary de outros
    if (dto.is_primary_contact) {
      await this.supabase
        .from('student_guardian_links')
        .update({ is_primary_contact: false })
        .eq('student_id', studentId)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null);
    }

    const { data, error } = await this.supabase
      .from('student_guardian_links')
      .insert({
        tenant_id: tenantId,
        student_id: studentId,
        guardian_id: dto.guardian_id,
        relationship: dto.relationship,
        custody_type: dto.custody_type ?? 'unknown',
        financial_responsible: dto.financial_responsible ?? false,
        pickup_allowed: dto.pickup_allowed ?? true,
        is_primary_contact: dto.is_primary_contact ?? false,
        contact_priority: dto.contact_priority ?? 1,
        notes: dto.notes ?? null,
        metadata: dto.metadata ?? {},
        ai_context: dto.ai_context ?? {},
        ai_summary: dto.ai_summary ?? null,
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to add guardian to student: ${error.message}`,
        undefined,
        'StudentsService',
      );
      throw new Error(`Failed to add guardian to student: ${error.message}`);
    }

    this.logger.log('Guardian added to student', 'StudentsService', {
      studentId,
      guardianId: dto.guardian_id,
    });

    return data as StudentGuardianLink;
  }

  async updateGuardianLink(
    linkId: string,
    tenantId: string,
    dto: UpdateStudentGuardianLinkDto,
    userId?: string,
  ): Promise<StudentGuardianLink> {
    const { data: existing } = await this.supabase
      .from('student_guardian_links')
      .select('*')
      .eq('id', linkId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (!existing) {
      throw new NotFoundException(`Vínculo com id '${linkId}' não encontrado`);
    }

    // Se is_primary_contact = true, remover primary de outros
    if (dto.is_primary_contact) {
      await this.supabase
        .from('student_guardian_links')
        .update({ is_primary_contact: false })
        .eq('student_id', existing.student_id)
        .eq('tenant_id', tenantId)
        .neq('id', linkId)
        .is('deleted_at', null);
    }

    const { data, error } = await this.supabase
      .from('student_guardian_links')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', linkId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update guardian link: ${error.message}`);
    }

    this.logger.log('Guardian link updated', 'StudentsService', { linkId });

    return data as StudentGuardianLink;
  }

  async removeGuardian(
    studentId: string,
    linkId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const { data: existing } = await this.supabase
      .from('student_guardian_links')
      .select('*')
      .eq('id', linkId)
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (!existing) {
      throw new NotFoundException(`Vínculo com id '${linkId}' não encontrado`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'student_guardian_links',
      linkId,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to remove guardian: ${result.error}`);
    }

    this.logger.log('Guardian removed from student', 'StudentsService', {
      studentId,
      linkId,
    });
  }
}
