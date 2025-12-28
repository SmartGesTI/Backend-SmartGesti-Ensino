import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { User, Auth0User } from '../common/types';
import { TenantsService } from '../tenants/tenants.service';

@Injectable()
export class UsersService {
  // Cache de usuários para evitar consultas repetidas
  private userCacheByAuth0Id = new Map<string, { user: User; expiresAt: number }>();
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
  private invalidateUserCache(userId: string, auth0Id?: string) {
    this.userCacheById.delete(userId);
    if (auth0Id) {
      this.userCacheByAuth0Id.delete(auth0Id);
    }
  }

  // Salvar usuário no cache
  private cacheUser(user: User) {
    const cacheEntry = { user, expiresAt: Date.now() + this.CACHE_TTL };
    this.userCacheById.set(user.id, cacheEntry);
    this.userCacheByAuth0Id.set(user.auth0_id, cacheEntry);
  }

  async syncUserFromAuth0(auth0User: Auth0User, subdomain?: string): Promise<User> {
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

    // Buscar usuário existente
    const { data: existingUser } = await this.supabase
      .from('users')
      .select('*')
      .eq('auth0_id', auth0User.sub)
      .single();

    if (existingUser) {
      // Atualizar usuário existente
      const updateData: Partial<User> = {
        email: auth0User.email,
        full_name: auth0User.name,
        avatar_url: auth0User.picture,
        updated_at: new Date().toISOString(),
      };

      // Se tenant encontrado e usuário não tem tenant, associar
      if (tenantId && !existingUser.tenant_id) {
        updateData.tenant_id = tenantId;
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
          auth0_id: auth0User.sub,
          email: auth0User.email,
          full_name: auth0User.name,
          avatar_url: auth0User.picture,
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
        description: `Usuário ${auth0User.email} criado no sistema`,
      });

      this.logger.log('User created successfully', 'UsersService', {
        userId: newUser.id,
        email: auth0User.email,
        tenantId,
      });

      const user = newUser as User;
      this.cacheUser(user); // Salvar no cache
      return user;
    }
  }

  async getUserByAuth0Id(auth0Id: string): Promise<User | null> {
    // Verificar cache primeiro
    const cached = this.userCacheByAuth0Id.get(auth0Id);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('auth0_id', auth0Id)
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
}
