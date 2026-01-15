import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

export interface Tag {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  color: string;
  category: string;
  description?: string;
  usage_count: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class TagsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Lista todas as tags de um tenant
   */
  async findAll(
    tenantId: string,
    filters?: {
      category?: string;
      search?: string;
    },
  ): Promise<Tag[]> {
    let query = this.supabase
      .getClient()
      .from('tags')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('usage_count', { ascending: false });

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error('Erro ao buscar tags', error.message, 'TagsService');
      throw new BadRequestException('Erro ao buscar tags');
    }

    return data || [];
  }

  /**
   * Busca uma tag por ID
   */
  async findOne(id: string, tenantId: string): Promise<Tag> {
    const { data, error } = await this.supabase
      .getClient()
      .from('tags')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Tag não encontrada');
    }

    return data;
  }

  /**
   * Busca tag por slug
   */
  async findBySlug(
    slug: string,
    tenantId: string,
    category?: string,
  ): Promise<Tag | null> {
    let query = this.supabase
      .getClient()
      .from('tags')
      .select('*')
      .eq('slug', slug)
      .eq('tenant_id', tenantId);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      this.logger.error(
        'Erro ao buscar tag por slug',
        error.message,
        'TagsService',
      );
      return null;
    }

    return data;
  }

  /**
   * Cria uma nova tag
   */
  async create(tenantId: string, createTagDto: CreateTagDto): Promise<Tag> {
    // Verificar se já existe tag com mesmo slug na categoria
    const category = createTagDto.category || 'general';
    const slug = createTagDto.slug || this.generateSlug(createTagDto.name);

    const existing = await this.findBySlug(slug, tenantId, category);
    if (existing) {
      throw new ConflictException(
        `Tag "${createTagDto.name}" já existe nesta categoria`,
      );
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('tags')
      .insert({
        tenant_id: tenantId,
        name: createTagDto.name,
        slug: slug,
        color: createTagDto.color || 'gray',
        category: category,
        description: createTagDto.description,
        is_system: createTagDto.is_system || false,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Erro ao criar tag', error.message, 'TagsService');
      throw new BadRequestException('Erro ao criar tag');
    }

    return data;
  }

  /**
   * Cria tag se não existir, ou retorna a existente
   */
  async findOrCreate(
    tenantId: string,
    name: string,
    category: string = 'general',
  ): Promise<Tag> {
    const slug = this.generateSlug(name);
    const existing = await this.findBySlug(slug, tenantId, category);

    if (existing) {
      return existing;
    }

    return this.create(tenantId, { name, category });
  }

  /**
   * Atualiza uma tag
   */
  async update(
    id: string,
    tenantId: string,
    updateTagDto: UpdateTagDto,
  ): Promise<Tag> {
    // Verificar se é tag do sistema
    const existing = await this.findOne(id, tenantId);
    if (existing.is_system) {
      throw new BadRequestException('Tags do sistema não podem ser editadas');
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('tags')
      .update({
        ...updateTagDto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      this.logger.error('Erro ao atualizar tag', error.message, 'TagsService');
      throw new BadRequestException('Erro ao atualizar tag');
    }

    return data;
  }

  /**
   * Remove uma tag
   */
  async remove(id: string, tenantId: string): Promise<void> {
    // Verificar se é tag do sistema
    const existing = await this.findOne(id, tenantId);
    if (existing.is_system) {
      throw new BadRequestException('Tags do sistema não podem ser removidas');
    }

    const { error } = await this.supabase
      .getClient()
      .from('tags')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      this.logger.error('Erro ao remover tag', error.message, 'TagsService');
      throw new BadRequestException('Erro ao remover tag');
    }
  }

  /**
   * Incrementa contador de uso de uma tag
   */
  async incrementUsage(id: string, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .rpc('increment_tag_usage', { tag_id: id, tenant: tenantId });

    // Se a função RPC não existir, fazer update manual
    if (error) {
      await this.supabase
        .getClient()
        .from('tags')
        .update({
          usage_count: this.supabase
            .getClient()
            .rpc('coalesce', { value: 'usage_count', default_value: 0 }),
        })
        .eq('id', id)
        .eq('tenant_id', tenantId);
    }
  }

  /**
   * Incrementa uso de múltiplas tags por nome
   */
  async incrementUsageByNames(
    tagNames: string[],
    tenantId: string,
    category: string = 'agent',
  ): Promise<void> {
    for (const name of tagNames) {
      const slug = this.generateSlug(name);
      const tag = await this.findBySlug(slug, tenantId, category);

      if (tag) {
        await this.supabase
          .getClient()
          .from('tags')
          .update({ usage_count: tag.usage_count + 1 })
          .eq('id', tag.id);
      } else {
        // Criar tag se não existir
        await this.create(tenantId, { name, category });
      }
    }
  }

  /**
   * Gera slug a partir do nome
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
      .replace(/\s+/g, '-') // Substitui espaços por hífen
      .replace(/-+/g, '-') // Remove hífens duplicados
      .trim();
  }
}
