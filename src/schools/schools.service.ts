import { Injectable, ForbiddenException, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { School } from '../common/types';
import { UsersService } from '../users/users.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

@Injectable()
export class SchoolsService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private usersService: UsersService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async getSchoolById(schoolId: string): Promise<School | null> {
    const { data, error } = await this.supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(
        `Failed to get school by id: ${error.message}`,
        undefined,
        'SchoolsService',
        { schoolId, error: error.message },
      );
      throw new Error(`Failed to get school: ${error.message}`);
    }

    return data as School;
  }

  async getSchoolBySlug(slug: string, tenantId?: string): Promise<School | null> {
    let query = this.supabase
      .from('schools')
      .select('*')
      .eq('slug', slug);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(
        `Failed to get school by slug: ${error.message}`,
        undefined,
        'SchoolsService',
        { slug, tenantId, error: error.message },
      );
      throw new Error(`Failed to get school: ${error.message}`);
    }

    return data as School;
  }

  async getSchoolsByTenant(tenantId: string): Promise<School[]> {
    const { data, error } = await this.supabase
      .from('schools')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) {
      this.logger.error(
        `Failed to get schools by tenant: ${error.message}`,
        undefined,
        'SchoolsService',
        {
          tenantId,
          error: error.message,
        },
      );
      throw new Error(`Failed to get schools: ${error.message}`);
    }

    return (data || []) as School[];
  }

  async getSchoolsByUser(userId: string): Promise<School[]> {
    // Buscar o usuário para obter o tenant_id
    const user = await this.usersService.getUserById(userId);
    if (!user || !user.tenant_id) {
      return [];
    }

    // Buscar escolas do tenant
    return this.getSchoolsByTenant(user.tenant_id);
  }

  async getSchoolsForCurrentUser(userId: string): Promise<School[]> {
    // Buscar escolas onde o usuário é membro
    const { data: memberships, error: membersError } = await this.supabase
      .from('school_members')
      .select('school_id')
      .eq('user_id', userId);

    if (membersError) {
      this.logger.error(
        `Failed to get school memberships: ${membersError.message}`,
        undefined,
        'SchoolsService',
        {
          userId,
          error: membersError.message,
        },
      );
      throw new Error(`Failed to get school memberships: ${membersError.message}`);
    }

    if (!memberships || memberships.length === 0) {
      return [];
    }

    const schoolIds = memberships.map((m) => m.school_id);
    const { data: schools, error: schoolsError } = await this.supabase
      .from('schools')
      .select('*')
      .in('id', schoolIds)
      .order('name', { ascending: true });

    if (schoolsError) {
      this.logger.error(
        `Failed to get schools: ${schoolsError.message}`,
        undefined,
        'SchoolsService',
        {
          schoolIds,
          error: schoolsError.message,
        },
      );
      throw new Error(`Failed to get schools: ${schoolsError.message}`);
    }

    return (schools || []) as School[];
  }

  async getCurrentSchool(userId: string): Promise<School | null> {
    const user = await this.usersService.getUserById(userId);
    if (!user || !user.current_school_id) {
      return null;
    }

    const { data, error } = await this.supabase
      .from('schools')
      .select('*')
      .eq('id', user.current_school_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(
        `Failed to get current school: ${error.message}`,
        undefined,
        'SchoolsService',
        {
          userId,
          schoolId: user.current_school_id,
          error: error.message,
        },
      );
      throw new Error(`Failed to get current school: ${error.message}`);
    }

    return data as School;
  }

  async setCurrentSchool(userId: string, schoolId: string, tenantId: string): Promise<void> {
    // A validação de que a escola pertence ao tenant já foi feita no controller
    // Aqui apenas atualizamos os dados

    // Verificar se o usuário já é membro da escola
    const { data: membership } = await this.supabase
      .from('school_members')
      .select('*')
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .single();

    // Se não é membro, adicionar automaticamente
    if (!membership) {
      await this.addUserToSchool(userId, schoolId, 'user');
      this.logger.log('User added to school', 'SchoolsService', { userId, schoolId, tenantId });
    }

    // Atualizar current_school_id e tenant_id do usuário
    const { error: updateError } = await this.supabase
      .from('users')
      .update({ 
        current_school_id: schoolId, 
        tenant_id: tenantId, // Sempre atualizar para garantir isolamento
        updated_at: new Date().toISOString() 
      })
      .eq('id', userId);

    if (updateError) {
      this.logger.error(
        `Failed to set current school: ${updateError.message}`,
        undefined,
        'SchoolsService',
        {
          userId,
          schoolId,
          error: updateError.message,
        },
      );
      throw new Error(`Failed to set current school: ${updateError.message}`);
    }

    this.logger.log('Current school updated', 'SchoolsService', { userId, schoolId });
  }

  async addUserToSchool(userId: string, schoolId: string, role: string = 'user'): Promise<void> {
    const { error } = await this.supabase.from('school_members').insert({
      user_id: userId,
      school_id: schoolId,
      role,
      permissions: {},
      created_at: new Date().toISOString(),
    });

    if (error) {
      // Se já existe, não é erro
      if (error.code !== '23505') {
        this.logger.error(
          `Failed to add user to school: ${error.message}`,
          undefined,
          'SchoolsService',
          {
            userId,
            schoolId,
            error: error.message,
          },
        );
        throw new Error(`Failed to add user to school: ${error.message}`);
      }
    }
  }

  /**
   * Gera slug a partir do nome da escola
   */
  private generateSlug(name: string, tenantId: string): string {
    // Converter para minúsculas
    let slug = name.toLowerCase();
    
    // Remover acentos
    slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Substituir espaços e caracteres especiais por hífen
    slug = slug.replace(/[^a-z0-9]+/g, '-');
    
    // Remover hífens no início e fim
    slug = slug.replace(/^-+|-+$/g, '');
    
    return slug;
  }

  /**
   * Garante que o slug seja único dentro do tenant
   */
  private async ensureUniqueSlug(baseSlug: string, tenantId: string, excludeSchoolId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      let query = this.supabase
        .from('schools')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('slug', slug);

      if (excludeSchoolId) {
        query = query.neq('id', excludeSchoolId);
      }

      const { data } = await query.single();

      if (!data) {
        // Slug está disponível
        return slug;
      }

      // Slug já existe, tentar com sufixo
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  async createSchool(tenantId: string, createSchoolDto: CreateSchoolDto): Promise<School> {
    // Validar campos obrigatórios
    if (!createSchoolDto.name) {
      throw new BadRequestException('name is required');
    }

    // Validar formato de CNPJ se fornecido
    if (createSchoolDto.cnpj) {
      const cleanedCnpj = createSchoolDto.cnpj.replace(/\D/g, '');
      if (cleanedCnpj.length !== 14) {
        throw new BadRequestException('CNPJ must have 14 digits');
      }
      createSchoolDto.cnpj = cleanedCnpj;
    }

    // Validar formato de CEP se fornecido
    if (createSchoolDto.endereco_cep) {
      const cleanedCep = createSchoolDto.endereco_cep.replace(/\D/g, '');
      if (cleanedCep.length !== 8) {
        throw new BadRequestException('CEP must have 8 digits');
      }
      createSchoolDto.endereco_cep = cleanedCep;
    }

    // Validar formato de Estado se fornecido
    if (createSchoolDto.endereco_estado && createSchoolDto.endereco_estado.length !== 2) {
      throw new BadRequestException('Estado (UF) must have 2 characters');
    }

    // Gerar slug único
    const baseSlug = this.generateSlug(createSchoolDto.name, tenantId);
    const slug = await this.ensureUniqueSlug(baseSlug, tenantId);

    const { data, error } = await this.supabase
      .from('schools')
      .insert({
        tenant_id: tenantId,
        slug,
        ...createSchoolDto,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Verificar se é erro de duplicação
      if (error.code === '23505') {
        if (error.message.includes('code')) {
          throw new ConflictException(`School with code '${createSchoolDto.code}' already exists in this tenant`);
        }
        if (error.message.includes('cnpj')) {
          throw new ConflictException(`School with CNPJ '${createSchoolDto.cnpj}' already exists in this tenant`);
        }
        throw new ConflictException('School with this information already exists');
      }

      this.logger.error(
        `Failed to create school: ${error.message}`,
        undefined,
        'SchoolsService',
        { error: error.message, name: createSchoolDto.name, tenantId },
      );
      throw new Error(`Failed to create school: ${error.message}`);
    }

    const school = data as School;

    this.logger.log('School created successfully', 'SchoolsService', {
      schoolId: school.id,
      name: school.name,
      slug: school.slug,
      tenantId,
    });

    return school;
  }

  async updateSchool(id: string, tenantId: string, updateSchoolDto: UpdateSchoolDto): Promise<School> {
    // Verificar se a escola existe e pertence ao tenant
    const existingSchool = await this.getSchoolById(id);
    if (!existingSchool) {
      throw new NotFoundException(`School with id '${id}' not found`);
    }

    if (existingSchool.tenant_id !== tenantId) {
      throw new ForbiddenException('School does not belong to this tenant');
    }

    // Validar formato de CNPJ se fornecido
    if (updateSchoolDto.cnpj) {
      const cleanedCnpj = updateSchoolDto.cnpj.replace(/\D/g, '');
      if (cleanedCnpj.length !== 14) {
        throw new BadRequestException('CNPJ must have 14 digits');
      }
      updateSchoolDto.cnpj = cleanedCnpj;
    }

    // Validar formato de CEP se fornecido
    if (updateSchoolDto.endereco_cep) {
      const cleanedCep = updateSchoolDto.endereco_cep.replace(/\D/g, '');
      if (cleanedCep.length !== 8) {
        throw new BadRequestException('CEP must have 8 digits');
      }
      updateSchoolDto.endereco_cep = cleanedCep;
    }

    // Validar formato de Estado se fornecido
    if (updateSchoolDto.endereco_estado && updateSchoolDto.endereco_estado.length !== 2) {
      throw new BadRequestException('Estado (UF) must have 2 characters');
    }

    // Se o nome mudou, atualizar o slug
    let updateData: any = { ...updateSchoolDto };
    if (updateSchoolDto.name && updateSchoolDto.name !== existingSchool.name) {
      const baseSlug = this.generateSlug(updateSchoolDto.name, tenantId);
      updateData.slug = await this.ensureUniqueSlug(baseSlug, tenantId, id);
    }

    const { data, error } = await this.supabase
      .from('schools')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Verificar se é erro de duplicação
      if (error.code === '23505') {
        if (error.message.includes('code')) {
          throw new ConflictException(`School with code '${updateSchoolDto.code}' already exists in this tenant`);
        }
        if (error.message.includes('cnpj')) {
          throw new ConflictException(`School with CNPJ '${updateSchoolDto.cnpj}' already exists in this tenant`);
        }
        throw new ConflictException('School with this information already exists');
      }

      this.logger.error(
        `Failed to update school: ${error.message}`,
        undefined,
        'SchoolsService',
        { error: error.message, schoolId: id },
      );
      throw new Error(`Failed to update school: ${error.message}`);
    }

    const school = data as School;

    this.logger.log('School updated successfully', 'SchoolsService', {
      schoolId: school.id,
      name: school.name,
      slug: school.slug,
    });

    return school;
  }

  async deleteSchool(id: string, tenantId: string): Promise<void> {
    // Verificar se a escola existe e pertence ao tenant
    const existingSchool = await this.getSchoolById(id);
    if (!existingSchool) {
      throw new NotFoundException(`School with id '${id}' not found`);
    }

    if (existingSchool.tenant_id !== tenantId) {
      throw new ForbiddenException('School does not belong to this tenant');
    }

    const { error } = await this.supabase
      .from('schools')
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error(
        `Failed to delete school: ${error.message}`,
        undefined,
        'SchoolsService',
        { error: error.message, schoolId: id },
      );
      throw new Error(`Failed to delete school: ${error.message}`);
    }

    this.logger.log('School deleted successfully', 'SchoolsService', {
      schoolId: id,
      name: existingSchool.name,
    });
  }
}
