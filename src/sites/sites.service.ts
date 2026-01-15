import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';

export interface Site {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  schoolId?: string;
  pages: Page[]; // Formato antigo (compatibilidade)
  template?: any; // Novo formato: LandingPageTemplate
  published: boolean;
  publishedHtml?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Page {
  id: string;
  name: string;
  slug: string;
  components: Component[];
  metadata: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
}

export interface Component {
  id: string;
  type: string;
  props: Record<string, any>;
  styles: Record<string, any>;
  children?: Component[];
}

@Injectable()
export class SitesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly logger: LoggerService,
  ) {}

  async findAll(projectId: string, schoolId?: string): Promise<Site[]> {
    let query = this.supabase
      .getClient()
      .from('sites')
      .select('*')
      .eq('project_id', projectId);

    if (schoolId) {
      query = query.eq('school_id', schoolId);
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) {
      this.logger.error(
        `Error fetching sites: ${error.message}`,
        'SitesService',
      );
      throw new BadRequestException('Failed to fetch sites');
    }

    return data.map(this.mapToSite);
  }

  async findOne(id: string, projectId: string): Promise<Site> {
    const { data, error } = await this.supabase
      .getClient()
      .from('sites')
      .select('*')
      .eq('id', id)
      .eq('project_id', projectId)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Site with ID ${id} not found`);
    }

    return this.mapToSite(data);
  }

  async create(site: Partial<Site>, userId: string): Promise<Site> {
    // Verificar se slug já existe para este projeto
    const existing = await this.supabase
      .getClient()
      .from('sites')
      .select('id')
      .eq('project_id', site.projectId)
      .eq('slug', site.slug)
      .single();

    if (existing.data) {
      throw new BadRequestException('Slug já existe para este projeto');
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('sites')
      .insert({
        project_id: site.projectId,
        name: site.name,
        slug: site.slug,
        school_id: site.schoolId || null,
        pages: site.pages || [],
        template: site.template || null, // Novo campo para template
        published: false,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Error creating site: ${error.message}`,
        'SitesService',
      );
      throw new BadRequestException('Failed to create site');
    }

    return this.mapToSite(data);
  }

  async update(
    id: string,
    site: Partial<Site>,
    projectId: string,
  ): Promise<Site> {
    const { data, error } = await this.supabase
      .getClient()
      .from('sites')
      .update({
        name: site.name,
        slug: site.slug,
        pages: site.pages,
        template: site.template || null, // Novo campo para template
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(
        `Error updating site: ${error?.message}`,
        'SitesService',
      );
      throw new NotFoundException(`Site with ID ${id} not found`);
    }

    return this.mapToSite(data);
  }

  async delete(id: string, projectId: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('sites')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId);

    if (error) {
      this.logger.error(
        `Error deleting site: ${error.message}`,
        'SitesService',
      );
      throw new BadRequestException('Failed to delete site');
    }
  }

  async publish(id: string, projectId: string): Promise<Site> {
    // Buscar o site
    const site = await this.findOne(id, projectId);

    // Gerar HTML estático
    const publishedHtml = this.generateHtml(site);

    const { data, error } = await this.supabase
      .getClient()
      .from('sites')
      .update({
        published: true,
        published_html: publishedHtml,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(
        `Error publishing site: ${error?.message}`,
        'SitesService',
      );
      throw new BadRequestException('Failed to publish site');
    }

    return this.mapToSite(data);
  }

  private generateHtml(site: Site): string {
    // Se tiver template (novo formato), usar template
    if (site.template) {
      return this.generateHtmlFromTemplate(site.template, site.name);
    }

    // Formato antigo (compatibilidade)
    const page = site.pages[0];
    if (!page) return '';

    let html = '<!DOCTYPE html><html lang="pt-BR"><head>';
    html += `<title>${page.metadata.title || site.name}</title>`;
    if (page.metadata.description) {
      html += `<meta name="description" content="${this.escapeHtml(page.metadata.description)}">`;
    }
    html +=
      '<meta name="viewport" content="width=device-width, initial-scale=1">';
    html += '<meta charset="UTF-8">';
    html += '</head><body>';

    page.components.forEach((component) => {
      html += this.renderComponent(component);
    });

    html += '</body></html>';
    return html;
  }

  private generateHtmlFromTemplate(template: any, siteName: string): string {
    // Gerar HTML a partir do template da landing page
    let html = '<!DOCTYPE html><html lang="pt-BR"><head>';
    html += `<title>${this.escapeHtml(template.name || siteName)}</title>`;
    html +=
      '<meta name="viewport" content="width=device-width, initial-scale=1">';
    html += '<meta charset="UTF-8">';

    // Incluir CSS da landing page (será servido estaticamente ou inline)
    html += '<link rel="stylesheet" href="/styles/landing-page.css">';

    // Aplicar cores customizadas via CSS variables
    if (template.sections && template.sections.length > 0) {
      const firstSection = template.sections[0];
      if (firstSection.config?.visual?.colors) {
        const colors = firstSection.config.visual.colors;
        html += '<style>:root {';
        if (colors.primary) html += `--lp-primary-color: ${colors.primary};`;
        if (colors.secondary)
          html += `--lp-secondary-color: ${colors.secondary};`;
        if (colors.background)
          html += `--lp-background-color: ${colors.background};`;
        if (colors.text) html += `--lp-text-color: ${colors.text};`;
        if (colors.accent) html += `--lp-accent-color: ${colors.accent};`;
        html += '}</style>';
      }
    }

    html += '</head><body>';

    // Renderizar seções do template
    if (template.sections) {
      template.sections.forEach((section: any) => {
        if (section.visible !== false) {
          html += this.renderSection(section);
        }
      });
    }

    html += '</body></html>';
    return html;
  }

  private renderSection(section: any): string {
    // Renderização básica das seções
    // Em produção, isso seria mais robusto e renderizaria os componentes React
    const config = section.config || {};
    const content = config.content || {};
    const visual = config.visual || {};
    const theme = visual.theme || 'light';

    let html = `<section id="${section.type}" class="lp-${section.type} lp-${section.type}-${section.variant}" data-theme="${theme}">`;

    // Renderizar conteúdo básico
    if (content.title) {
      html += `<h1>${this.escapeHtml(content.title)}</h1>`;
    }
    if (content.subtitle) {
      html += `<h2>${this.escapeHtml(content.subtitle)}</h2>`;
    }
    if (content.text) {
      html += `<p>${this.escapeHtml(content.text)}</p>`;
    }

    html += '</section>';
    return html;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  private renderComponent(component: Component): string {
    switch (component.type) {
      case 'hero':
        return `
          <section class="hero">
            <h1>${component.props.title || ''}</h1>
            <p>${component.props.subtitle || ''}</p>
            ${component.props.buttonText ? `<button>${component.props.buttonText}</button>` : ''}
          </section>
        `;
      case 'text':
        return `<p>${component.props.content || ''}</p>`;
      case 'heading':
        const level = component.props.level || 2;
        return `<h${level}>${component.props.text || ''}</h${level}>`;
      default:
        return '';
    }
  }

  /**
   * Busca dados dinâmicos para uma seção específica
   * Este método é genérico e busca dados baseado no tipo de seção
   * No futuro, pode ser estendido para buscar de tabelas específicas (testimonials, services, blog, etc)
   */
  async getSectionData(
    siteId: string,
    sectionId: string,
    projectId: string,
    type: string,
    filters?: {
      limit?: number;
      category?: string;
      tags?: string[];
      orderBy?: 'date' | 'title' | 'popularity';
      order?: 'asc' | 'desc';
    },
  ): Promise<{ items: any[]; total: number; hasMore: boolean }> {
    // Verificar se o site existe
    const site = await this.findOne(siteId, projectId);

    // Por enquanto, retornar dados mockados/vazios
    // No futuro, este método buscará dados reais do banco baseado no tipo
    // Exemplo: se type === 'testimonials', buscar da tabela testimonials
    // Exemplo: se type === 'services', buscar da tabela services
    // Exemplo: se type === 'blog', buscar da tabela blog_posts

    this.logger.log(
      `Buscando dados para seção ${sectionId} do tipo ${type} do site ${siteId}`,
      'SitesService',
    );

    // TODO: Implementar busca real do banco de dados baseado no tipo
    // Por enquanto, retornar array vazio (fallback para dados estáticos do template)
    return {
      items: [],
      total: 0,
      hasMore: false,
    };

    // Exemplo de implementação futura:
    // if (type === 'testimonials') {
    //   const { data, error } = await this.supabase
    //     .getClient()
    //     .from('testimonials')
    //     .select('*')
    //     .eq('site_id', siteId)
    //     .eq('published', true)
    //     .limit(filters?.limit || 10)
    //     .order(filters?.orderBy || 'created_at', { ascending: filters?.order === 'asc' });
    //
    //   if (error) {
    //     this.logger.error(`Error fetching testimonials: ${error.message}`, 'SitesService');
    //     return { items: [], total: 0, hasMore: false };
    //   }
    //
    //   return {
    //     items: data || [],
    //     total: data?.length || 0,
    //     hasMore: (data?.length || 0) >= (filters?.limit || 10),
    //   };
    // }
  }

  /**
   * Aplica um patch JSON Patch (RFC 6902) ao documento do site
   */
  async applyPatch(
    siteId: string,
    projectId: string,
    patches: any[],
    userId: string,
    authorType: 'user' | 'ai' | 'system' = 'user',
    description?: string,
  ): Promise<Site> {
    // Buscar site atual
    const site = await this.findOne(siteId, projectId);

    // Obter documento atual (template ou pages)
    let document: any = site.template || { pages: site.pages };

    // Aplicar patches (simulação - em produção, usar biblioteca JSON Patch)
    // Por enquanto, vamos apenas salvar os patches e atualizar o documento
    // TODO: Implementar aplicação real de patches JSON Patch

    // Criar nova versão
    const { data: versionData, error: versionError } = await this.supabase
      .getClient()
      .rpc('get_next_site_version', { p_site_id: siteId });

    if (versionError) {
      this.logger.error(
        `Error getting next version: ${versionError.message}`,
        'SitesService',
      );
      throw new BadRequestException('Failed to get next version');
    }

    const nextVersion = versionData || 1;

    // Salvar versão
    const { error: saveVersionError } = await this.supabase
      .getClient()
      .from('site_versions')
      .insert({
        site_id: siteId,
        version: nextVersion,
        patches: patches,
        author_type: authorType,
        author_id: userId,
        description,
      });

    if (saveVersionError) {
      this.logger.error(
        `Error saving version: ${saveVersionError.message}`,
        'SitesService',
      );
      throw new BadRequestException('Failed to save version');
    }

    // Atualizar documento do site (aplicar patches manualmente por enquanto)
    // TODO: Implementar aplicação real de patches
    const updatedDocument = { ...document };

    // Atualizar site
    const { data: updatedData, error: updateError } = await this.supabase
      .getClient()
      .from('sites')
      .update({
        template: updatedDocument,
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (updateError || !updatedData) {
      this.logger.error(
        `Error updating site: ${updateError?.message}`,
        'SitesService',
      );
      throw new BadRequestException('Failed to update site');
    }

    return this.mapToSite(updatedData);
  }

  /**
   * Lista versões de um site
   */
  async getVersions(siteId: string, projectId: string): Promise<any[]> {
    // Verificar se site existe
    await this.findOne(siteId, projectId);

    const { data, error } = await this.supabase
      .getClient()
      .from('site_versions')
      .select('*')
      .eq('site_id', siteId)
      .order('version', { ascending: false });

    if (error) {
      this.logger.error(
        `Error fetching versions: ${error.message}`,
        'SitesService',
      );
      throw new BadRequestException('Failed to fetch versions');
    }

    return (data || []).map((v: any) => ({
      id: v.id,
      version: v.version,
      patches: v.patches,
      snapshot: v.snapshot,
      authorType: v.author_type,
      authorId: v.author_id,
      description: v.description,
      createdAt: new Date(v.created_at),
    }));
  }

  /**
   * Faz rollback para uma versão específica
   */
  async rollbackToVersion(
    siteId: string,
    projectId: string,
    version: number,
    userId: string,
  ): Promise<Site> {
    // Verificar se site existe
    await this.findOne(siteId, projectId);

    // Buscar versão
    const { data: versionData, error: versionError } = await this.supabase
      .getClient()
      .from('site_versions')
      .select('*')
      .eq('site_id', siteId)
      .eq('version', version)
      .single();

    if (versionError || !versionData) {
      throw new NotFoundException(`Version ${version} not found`);
    }

    // Se tiver snapshot, usar snapshot
    // Caso contrário, aplicar patches inversos até a versão desejada
    let document: any;

    if (versionData.snapshot) {
      document = versionData.snapshot;
    } else {
      // Buscar todas as versões até a desejada e aplicar patches inversos
      // Por enquanto, vamos apenas buscar o documento atual
      const site = await this.findOne(siteId, projectId);
      document = site.template || { pages: site.pages };
      // TODO: Implementar aplicação inversa de patches
    }

    // Criar nova versão de rollback
    const { data: nextVersionData, error: nextVersionError } =
      await this.supabase
        .getClient()
        .rpc('get_next_site_version', { p_site_id: siteId });

    if (nextVersionError) {
      this.logger.error(
        `Error getting next version: ${nextVersionError.message}`,
        'SitesService',
      );
      throw new BadRequestException('Failed to get next version');
    }

    const nextVersion = nextVersionData || 1;

    // Salvar versão de rollback
    const { error: saveVersionError } = await this.supabase
      .getClient()
      .from('site_versions')
      .insert({
        site_id: siteId,
        version: nextVersion,
        patches: [], // Rollback não tem patches
        author_type: 'user',
        author_id: userId,
        description: `Rollback to version ${version}`,
        snapshot: document, // Salvar snapshot no rollback
      });

    if (saveVersionError) {
      this.logger.error(
        `Error saving rollback version: ${saveVersionError.message}`,
        'SitesService',
      );
      throw new BadRequestException('Failed to save rollback version');
    }

    // Atualizar site com documento restaurado
    const { data: updatedData, error: updateError } = await this.supabase
      .getClient()
      .from('sites')
      .update({
        template: document,
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (updateError || !updatedData) {
      this.logger.error(
        `Error updating site: ${updateError?.message}`,
        'SitesService',
      );
      throw new BadRequestException('Failed to update site');
    }

    return this.mapToSite(updatedData);
  }

  private mapToSite(data: any): Site {
    return {
      id: data.id,
      projectId: data.project_id,
      name: data.name,
      slug: data.slug,
      schoolId: data.school_id,
      pages: data.pages || [],
      template: data.template || null, // Novo campo para template
      published: data.published || false,
      publishedHtml: data.published_html,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at || data.created_at),
    };
  }
}
