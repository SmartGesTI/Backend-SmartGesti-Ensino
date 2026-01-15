import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';

export interface Owner {
  id: string;
  tenant_id: string;
  user_id: string;
  ownership_level: 'owner' | 'co-owner';
  granted_by: string | null;
  created_at: string;
  user: {
    id: string;
    email: string;
    name: string | null | undefined;
    auth0_id: string | null;
  };
}

@Injectable()
export class OwnersService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly logger: LoggerService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  /**
   * Adiciona um proprietário a uma instituição
   * @param tenantId - ID da instituição
   * @param userEmail - Email do usuário
   * @param ownershipLevel - Nível de propriedade (owner ou co-owner)
   * @param grantedBy - ID do usuário que concedeu (opcional)
   */
  async addOwner(
    tenantId: string,
    userEmail: string,
    ownershipLevel: 'owner' | 'co-owner' = 'owner',
    grantedBy?: string,
  ): Promise<Owner> {
    this.logger.log('Adding owner to tenant', 'OwnersService', {
      tenantId,
      userEmail,
      ownershipLevel,
    });

    // 1. Validar email
    if (!userEmail || !this.isValidEmail(userEmail)) {
      throw new BadRequestException('Invalid email format');
    }

    // 2. Buscar ou criar usuário
    const user = await this.usersService.findOrCreateByEmail(userEmail);

    // 3. Verificar se já é proprietário
    const { data: existing } = await this.supabase
      .getClient()
      .from('tenant_owners')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      throw new ConflictException(
        `User ${userEmail} is already an owner of this tenant`,
      );
    }

    // 4. Inserir em tenant_owners
    const { data: ownership, error: ownershipError } = await this.supabase
      .getClient()
      .from('tenant_owners')
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        ownership_level: ownershipLevel,
        granted_by: grantedBy || null,
      })
      .select()
      .single();

    if (ownershipError) {
      this.logger.error(
        `Failed to add owner: ${ownershipError.message}`,
        undefined,
        'OwnersService',
        {
          tenantId,
          userId: user.id,
          error: ownershipError.message,
        },
      );
      throw new BadRequestException(
        `Failed to add owner: ${ownershipError.message}`,
      );
    }

    // 5. Buscar role 'owner' do tenant
    const { data: role } = await this.supabase
      .getClient()
      .from('roles')
      .select('id')
      .eq('slug', 'owner')
      .eq('tenant_id', tenantId)
      .single();

    if (!role) {
      // Tentar buscar role de sistema (tenant_id NULL)
      const { data: systemRole } = await this.supabase
        .getClient()
        .from('roles')
        .select('id')
        .eq('slug', 'owner')
        .is('tenant_id', null)
        .single();

      if (systemRole) {
        // Atribuir role de sistema
        await this.assignOwnerRole(tenantId, user.id, systemRole.id);
      } else {
        this.logger.warn('Owner role not found for tenant', 'OwnersService', {
          tenantId,
        });
      }
    } else {
      // Atribuir role do tenant
      await this.assignOwnerRole(tenantId, user.id, role.id);
    }

    this.logger.log('Owner added successfully', 'OwnersService', {
      tenantId,
      userId: user.id,
      ownershipId: ownership.id,
    });

    // 6. Retornar dados completos
    return {
      id: ownership.id,
      tenant_id: ownership.tenant_id,
      user_id: ownership.user_id,
      ownership_level: ownership.ownership_level,
      granted_by: ownership.granted_by,
      created_at: ownership.created_at,
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name || user.email.split('@')[0],
        auth0_id: user.auth0_id,
      },
    };
  }

  /**
   * Atribui role de owner ao usuário
   */
  private async assignOwnerRole(
    tenantId: string,
    userId: string,
    roleId: string,
  ): Promise<void> {
    // Verificar se já tem o role
    const { data: existingRole } = await this.supabase
      .getClient()
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role_id', roleId)
      .eq('tenant_id', tenantId)
      .is('school_id', null)
      .single();

    if (existingRole) {
      return; // Já tem o role
    }

    // Atribuir role
    const { error } = await this.supabase
      .getClient()
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: roleId,
        tenant_id: tenantId,
        school_id: null,
      });

    if (error) {
      this.logger.warn(
        `Failed to assign owner role: ${error.message}`,
        'OwnersService',
        { userId, roleId, tenantId },
      );
    }
  }

  /**
   * Lista todos os proprietários de uma instituição
   */
  async listOwners(tenantId: string): Promise<Owner[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('tenant_owners')
      .select(
        `
        id,
        tenant_id,
        user_id,
        ownership_level,
        granted_by,
        created_at,
        users!inner (
          id,
          email,
          name,
          auth0_id
        )
      `,
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(
        `Failed to list owners: ${error.message}`,
        undefined,
        'OwnersService',
        { tenantId, error: error.message },
      );
      throw new BadRequestException(`Failed to list owners: ${error.message}`);
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      tenant_id: item.tenant_id,
      user_id: item.user_id,
      ownership_level: item.ownership_level,
      granted_by: item.granted_by,
      created_at: item.created_at,
      user: {
        id: item.users.id,
        email: item.users.email,
        name: item.users.name,
        auth0_id: item.users.auth0_id,
      },
    }));
  }

  /**
   * Remove um proprietário de uma instituição
   */
  async removeOwner(tenantId: string, userId: string): Promise<void> {
    this.logger.log('Removing owner from tenant', 'OwnersService', {
      tenantId,
      userId,
    });

    // 1. Verificar se não é o último owner
    const isLast = await this.isLastOwner(tenantId);
    if (isLast) {
      throw new UnprocessableEntityException(
        'Cannot remove the last owner of the tenant',
      );
    }

    // 2. Verificar se o ownership existe
    const { data: ownership } = await this.supabase
      .getClient()
      .from('tenant_owners')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .single();

    if (!ownership) {
      throw new NotFoundException('Owner not found');
    }

    // 3. Remover de tenant_owners
    const { error: deleteError } = await this.supabase
      .getClient()
      .from('tenant_owners')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('user_id', userId);

    if (deleteError) {
      this.logger.error(
        `Failed to remove owner: ${deleteError.message}`,
        undefined,
        'OwnersService',
        { tenantId, userId, error: deleteError.message },
      );
      throw new BadRequestException(
        `Failed to remove owner: ${deleteError.message}`,
      );
    }

    // 4. Remover role de owner
    const { data: role } = await this.supabase
      .getClient()
      .from('roles')
      .select('id')
      .eq('slug', 'owner')
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .single();

    if (role) {
      await this.supabase
        .getClient()
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', role.id)
        .eq('tenant_id', tenantId)
        .is('school_id', null);
    }

    this.logger.log('Owner removed successfully', 'OwnersService', {
      tenantId,
      userId,
    });
  }

  /**
   * Atualiza o nível de propriedade de um owner
   */
  async updateOwnershipLevel(
    tenantId: string,
    userId: string,
    ownershipLevel: 'owner' | 'co-owner',
  ): Promise<Owner> {
    this.logger.log('Updating ownership level', 'OwnersService', {
      tenantId,
      userId,
      ownershipLevel,
    });

    // Verificar se o ownership existe
    const { data: existing } = await this.supabase
      .getClient()
      .from('tenant_owners')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      throw new NotFoundException('Owner not found');
    }

    // Atualizar
    const { data, error } = await this.supabase
      .getClient()
      .from('tenant_owners')
      .update({ ownership_level: ownershipLevel })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .select(
        `
        id,
        tenant_id,
        user_id,
        ownership_level,
        granted_by,
        created_at,
        users!inner (
          id,
          email,
          name,
          auth0_id
        )
      `,
      )
      .single();

    if (error) {
      this.logger.error(
        `Failed to update ownership level: ${error.message}`,
        undefined,
        'OwnersService',
        { tenantId, userId, error: error.message },
      );
      throw new BadRequestException(
        `Failed to update ownership level: ${error.message}`,
      );
    }

    this.logger.log('Ownership level updated successfully', 'OwnersService', {
      tenantId,
      userId,
      ownershipLevel,
    });

    const users = data.users as any;
    return {
      id: data.id,
      tenant_id: data.tenant_id,
      user_id: data.user_id,
      ownership_level: data.ownership_level,
      granted_by: data.granted_by,
      created_at: data.created_at,
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
        auth0_id: users.auth0_id,
      },
    };
  }

  /**
   * Verifica se um tenant tem apenas um proprietário
   */
  async isLastOwner(tenantId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .getClient()
      .from('tenant_owners')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (error) {
      this.logger.error(
        `Failed to count owners: ${error.message}`,
        undefined,
        'OwnersService',
        { tenantId, error: error.message },
      );
      return false;
    }

    return count === 1;
  }

  /**
   * Valida formato de email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
