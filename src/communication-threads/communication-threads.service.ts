import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import {
  CommunicationThread,
  CommunicationMessage,
  CommunicationThreadParticipant,
  CommunicationThreadLink,
} from '../common/types';
import {
  CreateThreadDto,
  UpdateThreadDto,
  ScheduleThreadDto,
  SendThreadDto,
  CreateMessageDto,
  UpdateMessageDto,
  AddParticipantDto,
  UpdateParticipantDto,
  CreateThreadLinkDto,
} from './dto/create-thread.dto';

export interface ThreadWithRelations extends CommunicationThread {
  messages?: CommunicationMessage[];
  participants?: CommunicationThreadParticipant[];
  links?: CommunicationThreadLink[];
}

@Injectable()
export class CommunicationThreadsService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
  ) {}
  private get supabase() {
    return this.supabaseService.getClient();
  }

  async findAll(
    tenantId: string,
    options?: {
      schoolId?: string;
      threadType?: string;
      category?: string;
      status?: string;
    },
  ): Promise<CommunicationThread[]> {
    let q = this.supabase
      .from('communication_threads')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (options?.schoolId) q = q.eq('school_id', options.schoolId);
    if (options?.threadType) q = q.eq('thread_type', options.threadType);
    if (options?.category) q = q.eq('category', options.category);
    if (options?.status) q = q.eq('status', options.status);
    const { data, error } = await q;
    if (error) throw new BadRequestException('Falha ao buscar threads');
    return data || [];
  }

  async findOne(id: string, tenantId: string): Promise<ThreadWithRelations> {
    const { data, error } = await this.supabase
      .from('communication_threads')
      .select('*, messages:communication_messages(*)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();
    if (error || !data) throw new NotFoundException('Thread nao encontrada');
    const { data: p } = await this.supabase
      .from('communication_thread_participants')
      .select('*')
      .eq('thread_id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);
    const { data: l } = await this.supabase
      .from('communication_thread_links')
      .select('*')
      .eq('thread_id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);
    return { ...data, participants: p || [], links: l || [] };
  }

  async create(
    tenantId: string,
    dto: CreateThreadDto,
    userId?: string,
  ): Promise<CommunicationThread> {
    const insertData = {
      tenant_id: tenantId,
      school_id: dto.school_id || null,
      academic_year_id: dto.academic_year_id || null,
      thread_type: dto.thread_type,
      category: dto.category || 'general',
      priority: dto.priority || 'normal',
      subject: dto.subject || null,
      preview_text: dto.preview_text || null,
      requires_ack: dto.requires_ack || false,
      ack_deadline: dto.ack_deadline || null,
      status: 'draft',
      locked: false,
      source_entity_type: dto.source_entity_type || null,
      source_entity_id: dto.source_entity_id || null,
      metadata: dto.metadata || {},
      ai_context: dto.ai_context || null,
      ai_summary: dto.ai_summary || null,
      created_by: userId || null,
      updated_by: userId || null,
    };
    const { data, error } = await this.supabase
      .from('communication_threads')
      .insert(insertData)
      .select()
      .single();
    if (error) throw new BadRequestException('Falha ao criar thread');
    if (dto.thread_type === 'conversation' && userId) {
      await this.supabase.from('communication_thread_participants').insert({
        tenant_id: tenantId,
        school_id: dto.school_id || null,
        thread_id: data.id,
        participant_user_id: userId,
        participant_role: 'owner',
        is_muted: false,
        joined_at: new Date().toISOString(),
        created_by: userId,
      });
    }
    this.logger.log('Thread created', 'CommunicationThreadsService', {
      threadId: data.id,
    });
    return data;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateThreadDto,
    userId?: string,
  ): Promise<CommunicationThread> {
    const t = await this.findOne(id, tenantId);
    if (t.locked) throw new ForbiddenException('Bloqueada');
    if (!['draft', 'scheduled'].includes(t.status))
      throw new ForbiddenException('Apenas drafts');
    const u: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
    };
    if (dto.category !== undefined) u.category = dto.category;
    if (dto.priority !== undefined) u.priority = dto.priority;
    if (dto.subject !== undefined) u.subject = dto.subject;
    if (dto.preview_text !== undefined) u.preview_text = dto.preview_text;
    if (dto.requires_ack !== undefined) u.requires_ack = dto.requires_ack;
    if (dto.metadata !== undefined)
      u.metadata = { ...t.metadata, ...dto.metadata };
    const { data, error } = await this.supabase
      .from('communication_threads')
      .update(u)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw new BadRequestException('Falha');
    return data;
  }

  async schedule(
    id: string,
    tenantId: string,
    dto: ScheduleThreadDto,
    userId?: string,
  ): Promise<CommunicationThread> {
    const t = await this.findOne(id, tenantId);
    if (t.status !== 'draft') throw new ForbiddenException('Apenas drafts');
    const { data, error } = await this.supabase
      .from('communication_threads')
      .update({
        status: 'scheduled',
        scheduled_at: dto.scheduled_at,
        updated_at: new Date().toISOString(),
        updated_by: userId || null,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw new BadRequestException('Falha');
    return data;
  }

  async send(
    id: string,
    tenantId: string,
    dto: SendThreadDto,
    userId?: string,
  ): Promise<CommunicationThread> {
    const t = await this.findOne(id, tenantId);
    if (!['draft', 'scheduled'].includes(t.status) && !dto.force)
      throw new ForbiddenException('Nao enviavel');
    const { data, error } = await this.supabase
      .from('communication_threads')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        locked: true,
        updated_at: new Date().toISOString(),
        updated_by: userId || null,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw new BadRequestException('Falha');
    return data;
  }

  async cancel(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<CommunicationThread> {
    const t = await this.findOne(id, tenantId);
    if (!['draft', 'scheduled', 'sending'].includes(t.status))
      throw new ForbiddenException('Nao cancelavel');
    const { data, error } = await this.supabase
      .from('communication_threads')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
        updated_by: userId || null,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw new BadRequestException('Falha');
    return data;
  }

  async archive(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<CommunicationThread> {
    const { data, error } = await this.supabase
      .from('communication_threads')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
        updated_by: userId || null,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw new BadRequestException('Falha');
    return data;
  }

  async remove(id: string, tenantId: string, userId?: string): Promise<void> {
    const t = await this.findOne(id, tenantId);
    if (t.locked && t.status === 'sent')
      throw new ForbiddenException('Nao deletavel');
    await this.softDeleteService.softDelete(
      this.supabase,
      'communication_threads',
      id,
      userId ?? '',
    );
  }

  async findMessages(
    tid: string,
    tenId: string,
  ): Promise<CommunicationMessage[]> {
    await this.findOne(tid, tenId);
    const { data, error } = await this.supabase
      .from('communication_messages')
      .select('*')
      .eq('thread_id', tid)
      .eq('tenant_id', tenId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw new BadRequestException('Falha');
    return data || [];
  }

  async addMessage(
    tid: string,
    tenId: string,
    dto: CreateMessageDto,
    userId?: string,
  ): Promise<CommunicationMessage> {
    const t = await this.findOne(tid, tenId);
    const { data, error } = await this.supabase
      .from('communication_messages')
      .insert({
        tenant_id: tenId,
        school_id: t.school_id,
        thread_id: tid,
        author_type: dto.author_type || 'user',
        author_user_id: dto.author_user_id || userId || null,
        author_person_id: dto.author_person_id || null,
        message_type: dto.message_type || 'text',
        body: dto.body,
        body_format: dto.body_format || 'plain',
        metadata: dto.metadata || {},
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new BadRequestException('Falha');
    if (dto.body)
      await this.supabase
        .from('communication_threads')
        .update({ preview_text: dto.body.substring(0, 200) })
        .eq('id', tid);
    return data;
  }

  async updateMessage(
    tid: string,
    mid: string,
    tenId: string,
    dto: UpdateMessageDto,
    userId?: string,
  ): Promise<CommunicationMessage> {
    await this.findOne(tid, tenId);
    const u: Record<string, unknown> = {
      edited_at: new Date().toISOString(),
      edited_by: userId || null,
    };
    if (dto.body !== undefined) u.body = dto.body;
    if (dto.body_format !== undefined) u.body_format = dto.body_format;
    const { data, error } = await this.supabase
      .from('communication_messages')
      .update(u)
      .eq('id', mid)
      .eq('tenant_id', tenId)
      .select()
      .single();
    if (error) throw new BadRequestException('Falha');
    return data;
  }

  async removeMessage(
    tid: string,
    mid: string,
    tenId: string,
    userId?: string,
  ): Promise<void> {
    await this.findOne(tid, tenId);
    await this.softDeleteService.softDelete(
      this.supabase,
      'communication_messages',
      mid,
      userId ?? '',
    );
  }

  async findParticipants(
    tid: string,
    tenId: string,
  ): Promise<CommunicationThreadParticipant[]> {
    await this.findOne(tid, tenId);
    const { data, error } = await this.supabase
      .from('communication_thread_participants')
      .select('*')
      .eq('thread_id', tid)
      .eq('tenant_id', tenId)
      .is('deleted_at', null)
      .order('joined_at', { ascending: true });
    if (error) throw new BadRequestException('Falha');
    return data || [];
  }

  async addParticipant(
    tid: string,
    tenId: string,
    dto: AddParticipantDto,
    userId?: string,
  ): Promise<CommunicationThreadParticipant> {
    const t = await this.findOne(tid, tenId);
    if (!dto.participant_user_id && !dto.participant_person_id)
      throw new BadRequestException('Informe user ou person');
    const { data, error } = await this.supabase
      .from('communication_thread_participants')
      .insert({
        tenant_id: tenId,
        school_id: t.school_id,
        thread_id: tid,
        participant_user_id: dto.participant_user_id || null,
        participant_person_id: dto.participant_person_id || null,
        participant_role: dto.participant_role || 'member',
        is_muted: dto.is_muted || false,
        joined_at: new Date().toISOString(),
        metadata: dto.metadata || {},
        created_by: userId || null,
      })
      .select()
      .single();
    if (error) throw new BadRequestException('Falha');
    return data;
  }

  async updateParticipant(
    tid: string,
    pid: string,
    tenId: string,
    dto: UpdateParticipantDto,
  ): Promise<CommunicationThreadParticipant> {
    await this.findOne(tid, tenId);
    const u: Record<string, unknown> = {};
    if (dto.participant_role !== undefined)
      u.participant_role = dto.participant_role;
    if (dto.is_muted !== undefined) u.is_muted = dto.is_muted;
    const { data, error } = await this.supabase
      .from('communication_thread_participants')
      .update(u)
      .eq('id', pid)
      .eq('tenant_id', tenId)
      .select()
      .single();
    if (error) throw new BadRequestException('Falha');
    return data;
  }

  async removeParticipant(
    tid: string,
    pid: string,
    tenId: string,
  ): Promise<void> {
    await this.findOne(tid, tenId);
    await this.supabase
      .from('communication_thread_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('id', pid)
      .eq('tenant_id', tenId);
  }

  async findLinks(
    tid: string,
    tenId: string,
  ): Promise<CommunicationThreadLink[]> {
    await this.findOne(tid, tenId);
    const { data, error } = await this.supabase
      .from('communication_thread_links')
      .select('*')
      .eq('thread_id', tid)
      .eq('tenant_id', tenId)
      .is('deleted_at', null);
    if (error) throw new BadRequestException('Falha');
    return data || [];
  }

  async addLink(
    tid: string,
    tenId: string,
    dto: CreateThreadLinkDto,
    userId?: string,
  ): Promise<CommunicationThreadLink> {
    const t = await this.findOne(tid, tenId);
    const { data, error } = await this.supabase
      .from('communication_thread_links')
      .insert({
        tenant_id: tenId,
        school_id: t.school_id,
        thread_id: tid,
        entity_type: dto.entity_type,
        entity_id: dto.entity_id,
        metadata: dto.metadata || {},
        created_at: new Date().toISOString(),
        created_by: userId || null,
      })
      .select()
      .single();
    if (error) throw new BadRequestException('Falha');
    return data;
  }

  async removeLink(
    tid: string,
    lid: string,
    tenId: string,
    userId?: string,
  ): Promise<void> {
    await this.findOne(tid, tenId);
    await this.softDeleteService.softDelete(
      this.supabase,
      'communication_thread_links',
      lid,
      userId ?? '',
    );
  }
}
