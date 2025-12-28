import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class InvitationsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Cria um novo convite
   */
  async create(
    tenantId: string,
    createInvitationDto: CreateInvitationDto,
    invitedBy: string,
  ) {
    const { email, role_id, school_id, permission_group_id } =
      createInvitationDto;

    // Gerar token único
    const token = this.generateToken();

    // Definir data de expiração (7 dias)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Verificar se já existe convite pendente para este email
    const { data: existingInvite } = await this.supabase.getClient()
      .from('invitations')
      .select('id')
      .eq('email', email)
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      throw new BadRequestException(
        'Já existe um convite pendente para este email',
      );
    }

    // Criar convite
    const { data, error } = await this.supabase.getClient()
      .from('invitations')
      .insert({
        tenant_id: tenantId,
        school_id: school_id || null,
        invited_by: invitedBy,
        email,
        role_id,
        permission_group_id: permission_group_id || null,
        token,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Erro ao criar convite');
    }

    // TODO: Enviar email com link de convite
    // await this.sendInvitationEmail(email, token);

    return data;
  }

  /**
   * Lista todos os convites de um tenant
   */
  async findAll(tenantId: string, status?: string) {
    const query = this.supabase.getClient()
      .from('invitations')
      .select('*, roles(name), users!invited_by(full_name, email)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (status) {
      query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new BadRequestException('Erro ao buscar convites');
    }

    return data;
  }

  /**
   * Busca um convite por token
   */
  async findByToken(token: string) {
    const { data, error } = await this.supabase.getClient()
      .from('invitations')
      .select('*, roles(name, slug), tenants(name, subdomain)')
      .eq('token', token)
      .single();

    if (error || !data) {
      throw new NotFoundException('Convite não encontrado');
    }

    return data;
  }

  /**
   * Aceita um convite
   */
  async accept(token: string, userId: string) {
    // Buscar convite
    const invitation = await this.findByToken(token);

    // Verificar se está pendente
    if (invitation.status !== 'pending') {
      throw new BadRequestException('Este convite já foi processado');
    }

    // Verificar se está expirado
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    if (now > expiresAt) {
      // Marcar como expirado
      await this.supabase.getClient()
        .from('invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      throw new BadRequestException('Este convite expirou');
    }

    // Verificar se o email do usuário corresponde
    const { data: user } = await this.supabase.getClient()
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (!user || user.email !== invitation.email) {
      throw new BadRequestException(
        'Este convite não foi enviado para seu email',
      );
    }

    // Atribuir cargo ao usuário
    const { error: roleError } = await this.supabase.getClient()
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: invitation.role_id,
        tenant_id: invitation.tenant_id,
        school_id: invitation.school_id,
        assigned_by: invitation.invited_by,
      });

    if (roleError) {
      throw new BadRequestException('Erro ao atribuir cargo');
    }

    // Se houver grupo de permissões, atribuir também
    if (invitation.permission_group_id) {
      await this.supabase.getClient().from('user_permission_groups').insert({
        user_id: userId,
        permission_group_id: invitation.permission_group_id,
        tenant_id: invitation.tenant_id,
        school_id: invitation.school_id,
        assigned_by: invitation.invited_by,
      });
    }

    // Marcar convite como aceito
    const { data, error } = await this.supabase.getClient()
      .from('invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Erro ao aceitar convite');
    }

    return data;
  }

  /**
   * Cancela um convite
   */
  async cancel(id: string, tenantId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('invitations')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Convite não encontrado ou já processado');
    }

    return data;
  }

  /**
   * Deleta um convite
   */
  async remove(id: string, tenantId: string) {
    const { error } = await this.supabase.getClient()
      .from('invitations')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new BadRequestException('Erro ao deletar convite');
    }

    return { message: 'Convite deletado com sucesso' };
  }

  /**
   * Gera um token único para o convite
   */
  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Envia email com link de convite (TODO: implementar)
   */
  private async sendInvitationEmail(email: string, token: string) {
    // TODO: Implementar envio de email
    // const inviteLink = `${process.env.FRONTEND_URL}/convite/${token}`;
    // await emailService.send(email, 'Convite para SmartGesti Ensino', inviteLink);
  }
}
