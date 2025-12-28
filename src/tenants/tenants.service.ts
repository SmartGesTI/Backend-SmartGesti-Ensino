import { Injectable, BadRequestException, NotFoundException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { Tenant } from '../common/types';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { OwnersService } from '../owners/owners.service';

@Injectable()
export class TenantsService {
  // Cache de tenants para evitar consultas repetidas ao banco
  private tenantCacheBySubdomain = new Map<string, { tenant: Tenant; expiresAt: number }>();
  private tenantCacheById = new Map<string, { tenant: Tenant; expiresAt: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    @Inject(forwardRef(() => OwnersService))
    private ownersService: OwnersService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async getTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
    // Verificar cache primeiro
    const cached = this.tenantCacheBySubdomain.get(subdomain);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.tenant;
    }

    try {
      const { data, error } = await this.supabase
        .from('tenants')
        .select('*')
        .eq('subdomain', subdomain)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        // Se a tabela não existe, retornar null em vez de erro
        if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
          this.logger.warn(
            `Tenants table does not exist. Please run the migration.`,
            'TenantsService',
            { subdomain },
          );
          return null;
        }
        this.logger.error(
          `Failed to get tenant by subdomain: ${error.message}`,
          undefined,
          'TenantsService',
          {
            subdomain,
            error: error.message,
            errorCode: error.code,
          },
        );
        throw new Error(`Failed to get tenant: ${error.message}`);
      }

      const tenant = data as Tenant;
      
      // Salvar no cache
      this.tenantCacheBySubdomain.set(subdomain, {
        tenant,
        expiresAt: Date.now() + this.CACHE_TTL,
      });
      this.tenantCacheById.set(tenant.id, {
        tenant,
        expiresAt: Date.now() + this.CACHE_TTL,
      });

      return tenant;
    } catch (err: any) {
      // Tratar erros de rede/conexão
      if (err.message?.includes('fetch failed') || err.cause?.code === 'ECONNREFUSED') {
        this.logger.error(
          `Supabase connection failed. Check SUPABASE_URL and network connection.`,
          undefined,
          'TenantsService',
          {
            subdomain,
            error: err.message,
          },
        );
        throw new Error('Database connection failed. Please check your Supabase configuration.');
      }
      throw err;
    }
  }

  async getTenantById(tenantId: string): Promise<Tenant | null> {
    // Verificar cache primeiro
    const cached = this.tenantCacheById.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.tenant;
    }

    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(
        `Failed to get tenant by id: ${error.message}`,
        undefined,
        'TenantsService',
        {
          tenantId,
          error: error.message,
        },
      );
      throw new Error(`Failed to get tenant: ${error.message}`);
    }

    const tenant = data as Tenant;
    
    // Salvar no cache
    this.tenantCacheById.set(tenantId, {
      tenant,
      expiresAt: Date.now() + this.CACHE_TTL,
    });
    this.tenantCacheBySubdomain.set(tenant.subdomain, {
      tenant,
      expiresAt: Date.now() + this.CACHE_TTL,
    });

    return tenant;
  }

  async getAllTenants(): Promise<Tenant[]> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      this.logger.error(
        `Failed to get all tenants: ${error.message}`,
        undefined,
        'TenantsService',
        { error: error.message },
      );
      throw new Error(`Failed to get tenants: ${error.message}`);
    }

    return (data || []) as Tenant[];
  }

  async createTenant(createTenantDto: CreateTenantDto): Promise<Tenant> {
    // Validar campos obrigatórios
    if (!createTenantDto.subdomain || !createTenantDto.name) {
      throw new BadRequestException('subdomain and name are required');
    }

    // Validar formato de CNPJ se fornecido
    if (createTenantDto.cnpj) {
      const cleanedCnpj = createTenantDto.cnpj.replace(/\D/g, '');
      if (cleanedCnpj.length !== 14) {
        throw new BadRequestException('CNPJ must have 14 digits');
      }
      createTenantDto.cnpj = cleanedCnpj;
    }

    // Validar formato de CEP se fornecido
    if (createTenantDto.endereco_cep) {
      const cleanedCep = createTenantDto.endereco_cep.replace(/\D/g, '');
      if (cleanedCep.length !== 8) {
        throw new BadRequestException('CEP must have 8 digits');
      }
      createTenantDto.endereco_cep = cleanedCep;
    }

    // Validar formato de Estado se fornecido
    if (createTenantDto.endereco_estado && createTenantDto.endereco_estado.length !== 2) {
      throw new BadRequestException('Estado (UF) must have 2 characters');
    }

    const { data, error } = await this.supabase
      .from('tenants')
      .insert({
        ...createTenantDto,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Verificar se é erro de duplicação
      if (error.code === '23505') {
        if (error.message.includes('subdomain')) {
          throw new ConflictException(`Tenant with subdomain '${createTenantDto.subdomain}' already exists`);
        }
        if (error.message.includes('cnpj')) {
          throw new ConflictException(`Tenant with CNPJ '${createTenantDto.cnpj}' already exists`);
        }
        throw new ConflictException('Tenant with this information already exists');
      }

      this.logger.error(
        `Failed to create tenant: ${error.message}`,
        undefined,
        'TenantsService',
        { error: error.message, subdomain: createTenantDto.subdomain },
      );
      throw new Error(`Failed to create tenant: ${error.message}`);
    }

    const tenant = data as Tenant;

    // Invalidar cache
    this.tenantCacheBySubdomain.delete(tenant.subdomain);
    this.tenantCacheById.delete(tenant.id);

    this.logger.log('Tenant created successfully', 'TenantsService', {
      tenantId: tenant.id,
      subdomain: tenant.subdomain,
    });

    // Adicionar proprietário se fornecido
    let ownerData: any = null;
    if (createTenantDto.owner_email || createTenantDto.owner_auth0_id) {
      try {
        const ownerEmail = createTenantDto.owner_email;
        const ownershipLevel = createTenantDto.ownership_level || 'owner';

        if (ownerEmail) {
          ownerData = await this.ownersService.addOwner(
            tenant.id,
            ownerEmail,
            ownershipLevel,
          );

          this.logger.log('Owner added to tenant during creation', 'TenantsService', {
            tenantId: tenant.id,
            ownerEmail,
            ownerId: ownerData?.id,
          });
        }
      } catch (error: any) {
        // Log erro mas não falhar a criação do tenant
        this.logger.error(
          `Failed to add owner during tenant creation: ${error.message}`,
          undefined,
          'TenantsService',
          {
            tenantId: tenant.id,
            ownerEmail: createTenantDto.owner_email,
            error: error.message,
          },
        );
      }
    }

    // Retornar tenant com owner se foi adicionado
    return ownerData ? { ...tenant, owner: ownerData } as any : tenant;
  }

  async updateTenant(id: string, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
    // Verificar se o tenant existe
    const existingTenant = await this.getTenantById(id);
    if (!existingTenant) {
      throw new NotFoundException(`Tenant with id '${id}' not found`);
    }

    // Validar formato de CNPJ se fornecido
    if (updateTenantDto.cnpj) {
      const cleanedCnpj = updateTenantDto.cnpj.replace(/\D/g, '');
      if (cleanedCnpj.length !== 14) {
        throw new BadRequestException('CNPJ must have 14 digits');
      }
      updateTenantDto.cnpj = cleanedCnpj;
    }

    // Validar formato de CEP se fornecido
    if (updateTenantDto.endereco_cep) {
      const cleanedCep = updateTenantDto.endereco_cep.replace(/\D/g, '');
      if (cleanedCep.length !== 8) {
        throw new BadRequestException('CEP must have 8 digits');
      }
      updateTenantDto.endereco_cep = cleanedCep;
    }

    // Validar formato de Estado se fornecido
    if (updateTenantDto.endereco_estado && updateTenantDto.endereco_estado.length !== 2) {
      throw new BadRequestException('Estado (UF) must have 2 characters');
    }

    const { data, error } = await this.supabase
      .from('tenants')
      .update({
        ...updateTenantDto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Verificar se é erro de duplicação
      if (error.code === '23505') {
        if (error.message.includes('subdomain')) {
          throw new ConflictException(`Tenant with subdomain '${updateTenantDto.subdomain}' already exists`);
        }
        if (error.message.includes('cnpj')) {
          throw new ConflictException(`Tenant with CNPJ '${updateTenantDto.cnpj}' already exists`);
        }
        throw new ConflictException('Tenant with this information already exists');
      }

      this.logger.error(
        `Failed to update tenant: ${error.message}`,
        undefined,
        'TenantsService',
        { error: error.message, tenantId: id },
      );
      throw new Error(`Failed to update tenant: ${error.message}`);
    }

    const tenant = data as Tenant;

    // Invalidar cache
    this.tenantCacheBySubdomain.delete(tenant.subdomain);
    this.tenantCacheById.delete(tenant.id);
    // Também invalidar cache do subdomain antigo se mudou
    if (updateTenantDto.subdomain && updateTenantDto.subdomain !== existingTenant.subdomain) {
      this.tenantCacheBySubdomain.delete(existingTenant.subdomain);
    }

    this.logger.log('Tenant updated successfully', 'TenantsService', {
      tenantId: tenant.id,
      subdomain: tenant.subdomain,
    });

    return tenant;
  }

  async deleteTenant(id: string): Promise<void> {
    // Verificar se o tenant existe
    const existingTenant = await this.getTenantById(id);
    if (!existingTenant) {
      throw new NotFoundException(`Tenant with id '${id}' not found`);
    }

    const { error } = await this.supabase
      .from('tenants')
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error(
        `Failed to delete tenant: ${error.message}`,
        undefined,
        'TenantsService',
        { error: error.message, tenantId: id },
      );
      throw new Error(`Failed to delete tenant: ${error.message}`);
    }

    // Invalidar cache
    this.tenantCacheBySubdomain.delete(existingTenant.subdomain);
    this.tenantCacheById.delete(id);

    this.logger.log('Tenant deleted successfully', 'TenantsService', {
      tenantId: id,
      subdomain: existingTenant.subdomain,
    });
  }
}
