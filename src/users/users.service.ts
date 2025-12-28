import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { User, SupabaseUser } from '../common/types';
import { TenantsService } from '../tenants/tenants.service';
import { UserStatusDto } from './dto/user-status.dto';

@Injectable()
export class UsersService {
  // Cache de usuários para evitar consultas repetidas
  private userCacheBySupabaseId = new Map<string, { user: User; expiresAt: number }>();
  private userCacheById = new Map<string, { user: User; expiresAt: number }>();
  private readonly CACHE_TTL = 60 * 1000; // 1 minuto (menor que tenant pois user muda mais)

  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private tenantsService: TenantsService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  // Limpar cache do usuário (chamado após updates)
  private invalidateUserCache(userId: string, supabaseId?: string) {
    this.userCacheById.delete(userId);
    if (supabaseId) {
      this.userCacheBySupabaseId.delete(supabaseId);
    }
  }

  // Salvar usuário no cache
  private cacheUser(user: User) {
    const cacheEntry = { user, expiresAt: Date.now() + this.CACHE_TTL };
    this.userCacheById.set(user.id, cacheEntry);
    // auth0_id armazena o UUID do Supabase (mantido para compatibilidade com schema existente)
    this.userCacheBySupabaseId.set(user.auth0_id, cacheEntry);
  }

  async syncUserFromSupabase(supabaseUser: SupabaseUser, subdomain?: string): Promise<User> {
    // VALIDAÇÃO CRÍTICA: Verificar se email foi verificado
    // Para usuários OAuth (Google, etc), considerar email como verificado
    // pois o provedor OAuth já faz essa verificação
    // 
    // Verificamos:
    // 1. Se email_verified está explicitamente true
    // 2. Se há user_metadata (indica que é um usuário OAuth, que já tem email verificado)
    const isEmailVerified = supabaseUser.email_verified === true || 
                            // Se há user_metadata, é provável que seja um usuário OAuth (Google, etc)
                            // que já tem email verificado pelo provedor
                            (supabaseUser.user_metadata && Object.keys(supabaseUser.user_metadata).length > 0);
    
    if (!isEmailVerified) {
      this.logger.warn('User attempted to login with unverified email', 'UsersService', {
        email: supabaseUser.email,
        supabaseUserId: supabaseUser.id,
        email_verified: supabaseUser.email_verified,
        has_metadata: !!supabaseUser.user_metadata,
        metadata_keys: supabaseUser.user_metadata ? Object.keys(supabaseUser.user_metadata) : [],
      });
      throw new Error('Email não verificado. Verifique seu email antes de continuar.');
    }

    // Se subdomain fornecido, buscar tenant
    let tenantId: string | undefined;
    if (subdomain) {
      const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);
      if (tenant) {
        tenantId = tenant.id;
      } else {
        this.logger.warn(`Tenant not found for subdomain: ${subdomain}`, 'UsersService');
      }
    }

    // Buscar usuário existente por auth0_id (armazena UUID do Supabase) OU email
    // NOTA: Campo auth0_id mantido no schema para compatibilidade, mas agora armazena Supabase UUID
    const { data: users, error: searchError } = await this.supabase
      .from('users')
      .select('*')
      .or(`auth0_id.eq.${supabaseUser.id},email.eq.${supabaseUser.email}`)
      .limit(2);

    if (searchError) {
      this.logger.error(
        'Error searching user',
        searchError.message,
        'UsersService',
        { supabaseUserId: supabaseUser.id, email: supabaseUser.email },
      );
    }

    const existingUser = users?.[0];

    // Verificar se há duplicatas (múltiplos usuários com mesmo email)
    if (users && users.length > 1) {
      this.logger.warn(
        'Multiple users found with same email',
        'UsersService',
        {
          email: supabaseUser.email,
          count: users.length,
          userIds: users.map((u) => u.id),
        },
      );
    }

    if (existingUser) {
      // VALIDAÇÃO CRÍTICA: Se usuário já tem tenant_id, não pode acessar outro tenant
      if (existingUser.tenant_id && tenantId && existingUser.tenant_id !== tenantId) {
        this.logger.error(
          'User attempted to access different tenant',
          undefined,
          'UsersService',
          {
            userId: existingUser.id,
            userEmail: existingUser.email,
            userTenantId: existingUser.tenant_id,
            attemptedTenantId: tenantId,
            subdomain,
          },
        );
        throw new Error(
          'Acesso negado: este usuário pertence a outra instituição',
        );
      }

      // Atualizar usuário existente
      const updateData: Partial<User> = {
        email: supabaseUser.email,
        full_name: supabaseUser.user_metadata?.full_name || supabaseUser.name,
        avatar_url: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture || supabaseUser.picture,
        email_verified: supabaseUser.email_verified ?? false,
        updated_at: new Date().toISOString(),
      };

      // Se auth0_id diferente, atualizar (usuário trocou de provider ou migração)
      // auth0_id armazena o UUID do Supabase
      if (existingUser.auth0_id !== supabaseUser.id) {
        updateData.auth0_id = supabaseUser.id;
        this.logger.log(
          'Updating supabase_id (auth0_id field) for existing user',
          'UsersService',
          {
            userId: existingUser.id,
            email: existingUser.email,
            oldSupabaseId: existingUser.auth0_id,
            newSupabaseId: supabaseUser.id,
          },
        );
      }

      // Se tenant encontrado e usuário não tem tenant, associar (primeira vez)
      if (tenantId && !existingUser.tenant_id) {
        updateData.tenant_id = tenantId;
        this.logger.log(
          'User linked to tenant for first time',
          'UsersService',
          {
            userId: existingUser.id,
            email: existingUser.email,
            tenantId,
            subdomain,
          },
        );
      }

      const { data: updatedUser, error } = await this.supabase
        .from('users')
        .update(updateData)
        .eq('id', existingUser.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update user: ${error.message}`);
      }

      const user = updatedUser as User;
      this.cacheUser(user); // Atualizar cache
      return user;
    } else {
      // Criar novo usuário
      const { data: newUser, error } = await this.supabase
        .from('users')
        .insert({
          auth0_id: supabaseUser.id, // Campo auth0_id armazena UUID do Supabase (compatibilidade com schema)
          email: supabaseUser.email,
          full_name: supabaseUser.user_metadata?.full_name || supabaseUser.name,
          avatar_url: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture || supabaseUser.picture,
          email_verified: supabaseUser.email_verified ?? false,
          role: 'user',
          tenant_id: tenantId,
          ai_context: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create user: ${error.message}`);
      }

      // Log de atividade
      await this.logActivity(newUser.id, 'user_created', 'user', newUser.id, {
        description: `Usuário ${supabaseUser.email} criado no sistema`,
      });

      this.logger.log('User created successfully', 'UsersService', {
        userId: newUser.id,
        email: supabaseUser.email,
        tenantId,
      });

      const user = newUser as User;
      this.cacheUser(user); // Salvar no cache
      return user;
    }
  }

  /**
   * Busca usuário por EMAIL (método principal)
   * Email é a chave principal de identificação do sistema
   * @param email - Email do usuário
   * @returns User ou null
   */
  async getUserByEmail(email: string): Promise<User | null> {
    if (!email) return null;

    // Verificar cache primeiro (usando email como chave)
    const cacheKey = `email_${email}`;
    const cached = this.userCacheBySupabaseId.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get user by email: ${error.message}`);
    }

    const user = data as User;
    
    // Cachear por email
    this.userCacheBySupabaseId.set(cacheKey, {
      user,
      expiresAt: Date.now() + this.CACHE_TTL,
    });
    
    // Cachear também por ID
    this.cacheUser(user);
    
    return user;
  }

  /**
   * Busca usuário por Supabase ID (armazenado no campo auth0_id para compatibilidade)
   * NOTA: Preferir getUserByEmail() como método principal
   * @param supabaseId - UUID do Supabase (armazenado em auth0_id)
   * @returns User ou null
   */
  async getUserByAuth0Id(supabaseId: string): Promise<User | null> {
    if (!supabaseId) return null;

    // Verificar cache primeiro
    const cached = this.userCacheBySupabaseId.get(supabaseId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('auth0_id', supabaseId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get user: ${error.message}`);
    }

    const user = data as User;
    this.cacheUser(user);
    return user;
  }

  async getUserById(userId: string): Promise<User | null> {
    // Verificar cache primeiro
    const cached = this.userCacheById.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get user: ${error.message}`);
    }

    const user = data as User;
    this.cacheUser(user);
    return user;
  }

  /**
   * Busca usuário por email ou cria novo se não existir
   * @param email - Email do usuário
   * @returns User
   */
  async findOrCreateByEmail(email: string): Promise<User> {
    // Buscar usuário existente por email
    const { data: existingUser } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (existingUser) {
      const user = existingUser as User;
      this.cacheUser(user);
      return user;
    }

    // Criar novo usuário com auth0_id null (será preenchido no primeiro login via Supabase)
    const { data: newUser, error } = await this.supabase
      .from('users')
      .insert({
        email,
        auth0_id: null, // Será preenchido quando fizer login via Supabase
        full_name: email.split('@')[0], // Nome temporário baseado no email
        role: 'user',
        ai_context: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to create user by email: ${error.message}`,
        undefined,
        'UsersService',
        { email, error: error.message },
      );
      throw new Error(`Failed to create user: ${error.message}`);
    }

    this.logger.log('User created by email', 'UsersService', {
      userId: newUser.id,
      email,
    });

    const user = newUser as User;
    this.cacheUser(user);
    return user;
  }

  /**
   * Completa o perfil do usuário com nome, sobrenome e avatar
   * @param supabaseId - UUID do Supabase (armazenado em auth0_id)
   * @param dto - Dados do perfil
   * @returns User atualizado
   */
  async completeProfile(supabaseId: string, dto: { given_name: string; family_name: string; avatar_url?: string }): Promise<User> {
    const user = await this.getUserByAuth0Id(supabaseId);
    
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const fullName = `${dto.given_name.trim()} ${dto.family_name.trim()}`;

    // 1. Atualizar na tabela users do banco
    const { data, error } = await this.supabase
      .from('users')
      .update({
        full_name: fullName,
        avatar_url: dto.avatar_url || user.avatar_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to complete profile', error.message, 'UsersService', {
        userId: user.id,
        error: error.message,
      });
      throw new Error(`Erro ao completar perfil: ${error.message}`);
    }

    // 2. IMPORTANTE: Atualizar user_metadata no Supabase Auth para atualizar Display name
    // Isso atualiza o nome que aparece em Authentication > Users no Supabase Dashboard
    try {
      const supabaseAdmin = this.supabaseService.getClient();
      // Buscar metadados atuais do usuário no Supabase Auth para preservar
      const { data: { user: supabaseAuthUser } } = await supabaseAdmin.auth.admin.getUserById(supabaseId);
      
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
        supabaseId,
        {
          user_metadata: {
            ...(supabaseAuthUser?.user_metadata || {}), // Preservar metadados existentes
            full_name: fullName,
            given_name: dto.given_name.trim(),
            family_name: dto.family_name.trim(),
            ...(dto.avatar_url && { avatar_url: dto.avatar_url }),
          },
        }
      );

      if (updateAuthError) {
        this.logger.warn('Failed to update Supabase Auth user metadata', 'UsersService', {
          userId: user.id,
          error: updateAuthError.message,
        });
        // Não bloquear se falhar, mas logar o erro
      } else {
        this.logger.log('Supabase Auth user metadata updated successfully', 'UsersService', {
          userId: user.id,
          fullName,
        });
      }
    } catch (updateError: any) {
      this.logger.warn('Exception updating Supabase Auth user metadata', 'UsersService', {
        userId: user.id,
        error: updateError.message,
      });
      // Não bloquear se falhar
    }

    // Log de atividade
    await this.logActivity(user.id, 'profile_completed', 'user', user.id, {
      description: `Perfil completado: ${fullName}`,
      given_name: dto.given_name,
      family_name: dto.family_name,
    });

    // Invalidar cache
    this.invalidateUserCache(user.id, supabaseId);

    this.logger.log('Profile completed successfully', 'UsersService', {
      userId: user.id,
      email: user.email,
      fullName,
    });

    return data as User;
  }

  async logActivity(
    userId: string,
    action: string,
    entityType: string,
    entityId: string | undefined,
    metadata: { description: string; [key: string]: unknown },
  ): Promise<void> {
    await this.supabase.from('activity_logs').insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      description: metadata.description,
      metadata: { ...metadata, description: undefined },
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Verifica se usuário é owner de um tenant
   * @param userId - UUID do usuário
   * @param tenantId - UUID do tenant
   * @returns boolean
   */
  async isOwner(userId: string, tenantId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('tenant_owners')
      .select('id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    
    return !!data;
  }

  /**
   * Verifica o status do usuário (tenant, escolas, roles, ownership)
   * @param supabaseId - UUID do Supabase (armazenado em auth0_id)
   * @returns UserStatusDto
   */
  async getUserStatus(supabaseId: string): Promise<UserStatusDto> {
    const user = await this.getUserByAuth0Id(supabaseId);

    if (!user) {
      return {
        hasTenant: false,
        hasSchools: false,
        hasRoles: false,
        isOwner: false,
        emailVerified: false,
        hasCompletedProfile: false,
        status: 'pending',
        message: 'Usuário não encontrado no sistema',
      };
    }

    const hasTenant = !!user.tenant_id;
    const emailVerified = !!user.email_verified;
    
    // Verificar perfil completo (nome e sobrenome)
    const hasCompletedProfile = !!(
      user.full_name && 
      user.full_name.trim().split(' ').length >= 2
    );

    // Verificar se tem escolas
    let hasSchools = false;
    if (user.tenant_id) {
      const { data: schools } = await this.supabase
        .from('schools')
        .select('id')
        .eq('tenant_id', user.tenant_id)
        .limit(1);
      hasSchools = !!schools && schools.length > 0;
    }

    // Verificar se tem roles
    let hasRoles = false;
    if (user.tenant_id) {
      const { data: roles } = await this.supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('tenant_id', user.tenant_id)
        .limit(1);
      hasRoles = !!roles && roles.length > 0;
    }

    // Verificar se é owner
    const isOwnerStatus = user.tenant_id 
      ? await this.isOwner(user.id, user.tenant_id)
      : false;

    // Determinar status com prioridade
    let status: 'active' | 'pending' | 'blocked' | 'incomplete_profile' | 'email_unverified' = 'pending';
    let message: string | undefined;

    if (!emailVerified) {
      status = 'email_unverified';
      message = 'Verifique seu email antes de continuar';
    } else if (!hasCompletedProfile) {
      status = 'incomplete_profile';
      message = 'Complete seu cadastro com nome e sobrenome';
    } else if (hasTenant && (hasSchools || hasRoles || isOwnerStatus)) {
      status = 'active';
    } else {
      status = 'pending';
      message = 'Aguardando aprovação do administrador';
    }

    return {
      hasTenant,
      hasSchools,
      hasRoles,
      isOwner: isOwnerStatus,
      emailVerified,
      hasCompletedProfile,
      status,
      message,
    };
  }
}
