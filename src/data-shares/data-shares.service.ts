import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import {
  DataShare,
  DataShareWithRelations,
  DataShareToken,
  DataShareAccessLog,
  AcademicRecordSnapshot,
} from '../common/types';
import {
  CreateDataShareDto,
  CreateTokenDto,
  RevokeDataShareDto,
} from './dto/create-data-share.dto';

const HASH_ALGO = 'sha256';
const HASH_ENCODING = 'hex';
const TOKEN_BYTES = 32;

@Injectable()
export class DataSharesService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  private generateToken(): { token: string; hash: string; hint: string } {
    const token = randomBytes(TOKEN_BYTES).toString('hex');
    const hash = createHash(HASH_ALGO).update(token).digest(HASH_ENCODING);
    const hint =
      token.substring(0, 8) + '...' + token.substring(token.length - 4);
    return { token, hash, hint };
  }

  private hashToken(token: string): string {
    return createHash(HASH_ALGO).update(token).digest(HASH_ENCODING);
  }

  async findAll(
    tenantId: string,
    options?: { snapshotId?: string; status?: string },
  ): Promise<DataShare[]> {
    let query = this.supabase
      .from('data_shares')
      .select('*')
      .eq('source_tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (options?.snapshotId) {
      query = query.eq('snapshot_id', options.snapshotId);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to list data shares: ${error.message}`);
    }
    return (data || []) as DataShare[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<DataShareWithRelations | null> {
    const { data, error } = await this.supabase
      .from('data_shares')
      .select('*, academic_record_snapshots(*), consents(*)')
      .eq('id', id)
      .eq('source_tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get data share: ${error.message}`);
    }

    const { data: tokens } = await this.supabase
      .from('data_share_tokens')
      .select('*')
      .eq('data_share_id', id)
      .is('deleted_at', null);

    return {
      ...data,
      snapshot: (data as any).academic_record_snapshots,
      consent: (data as any).consents,
      tokens: tokens || [],
    } as DataShareWithRelations;
  }

  async create(
    tenantId: string,
    schoolId: string | null,
    dto: CreateDataShareDto,
    userId?: string,
  ): Promise<DataShare> {
    const { data: snapshot } = await this.supabase
      .from('academic_record_snapshots')
      .select('id, tenant_id, status')
      .eq('id', dto.snapshot_id)
      .is('deleted_at', null)
      .single();

    if (!snapshot) {
      throw new NotFoundException(
        `Snapshot com id '${dto.snapshot_id}' nao encontrado`,
      );
    }
    if (snapshot.tenant_id !== tenantId) {
      throw new ForbiddenException('Snapshot pertence a outro tenant');
    }
    if (snapshot.status === 'revoked') {
      throw new BadRequestException(
        'Nao e possivel compartilhar um snapshot revogado',
      );
    }

    const expiresAt = new Date(dto.expires_at);
    if (expiresAt <= new Date()) {
      throw new BadRequestException('Data de expiracao deve ser no futuro');
    }

    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('data_shares')
      .insert({
        source_tenant_id: tenantId,
        source_school_id: schoolId,
        target_tenant_id: dto.target_tenant_id ?? null,
        target_school_id: dto.target_school_id ?? null,
        snapshot_id: dto.snapshot_id,
        consent_id: dto.consent_id ?? null,
        purpose: dto.purpose ?? null,
        scope: dto.scope ?? {},
        status: 'active',
        expires_at: dto.expires_at,
        max_accesses: dto.max_accesses ?? 1,
        access_count: 0,
        metadata: {},
        ai_context: dto.ai_context ?? {},
        ai_summary: dto.ai_summary ?? null,
        created_at: now,
        created_by: userId ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create data share: ${error.message}`);
    }

    this.logger.log('Data share created', 'DataSharesService', { id: data.id });
    return data as DataShare;
  }

  async revoke(
    id: string,
    tenantId: string,
    dto: RevokeDataShareDto,
    userId: string,
  ): Promise<DataShare> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Data share com id '${id}' nao encontrado`);
    }
    if (existing.status === 'revoked') {
      throw new BadRequestException('Este compartilhamento ja esta revogado');
    }

    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('data_shares')
      .update({ status: 'revoked', revoked_at: now, revoked_by: userId })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to revoke data share: ${error.message}`);
    }

    await this.supabase
      .from('data_share_tokens')
      .update({ status: 'revoked', revoked_at: now, revoked_by: userId })
      .eq('data_share_id', id)
      .eq('status', 'active')
      .is('deleted_at', null);

    this.logger.log('Data share revoked', 'DataSharesService', { id });
    return data as DataShare;
  }

  async createToken(
    shareId: string,
    tenantId: string,
    dto: CreateTokenDto,
    userId?: string,
  ): Promise<{ token: string; token_hint: string; expires_at: string | null }> {
    const share = await this.findOne(shareId, tenantId);
    if (!share) {
      throw new NotFoundException(
        `Data share com id '${shareId}' nao encontrado`,
      );
    }
    if (share.status !== 'active') {
      throw new BadRequestException(
        'Nao e possivel gerar tokens para compartilhamentos inativos',
      );
    }

    const { token, hash, hint } = this.generateToken();
    const now = new Date().toISOString();
    const expiresAt = dto.expires_at ?? share.expires_at;

    const { data, error } = await this.supabase
      .from('data_share_tokens')
      .insert({
        data_share_id: shareId,
        token_hash: hash,
        hash_algo: HASH_ALGO,
        hash_encoding: HASH_ENCODING,
        token_hint: hint,
        status: 'active',
        expires_at: expiresAt,
        max_uses: dto.max_uses ?? 1,
        uses_count: 0,
        metadata: {},
        created_at: now,
        created_by: userId ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create token: ${error.message}`);
    }

    this.logger.log('Token created', 'DataSharesService', {
      shareId,
      tokenId: data.id,
    });
    return { token, token_hint: hint, expires_at: expiresAt };
  }

  async validateToken(
    token: string,
    requestInfo: {
      ip?: string;
      userAgent?: string;
      userId?: string;
      tenantId?: string;
    },
  ): Promise<{
    valid: boolean;
    snapshot?: AcademicRecordSnapshot;
    message?: string;
  }> {
    const tokenHash = this.hashToken(token);

    const { data: tokenData } = await this.supabase
      .from('data_share_tokens')
      .select('*, data_shares(*)')
      .eq('token_hash', tokenHash)
      .is('deleted_at', null)
      .single();

    if (!tokenData) {
      await this.logAccess(
        null,
        null,
        'validate',
        'denied',
        { reason: 'token_not_found' },
        requestInfo,
      );
      return { valid: false, message: 'Token invalido' };
    }

    const shareData = (tokenData as any).data_shares;

    if (tokenData.status !== 'active') {
      await this.logAccess(
        shareData?.id,
        tokenData.id,
        'validate',
        tokenData.status,
        {},
        requestInfo,
      );
      return { valid: false, message: `Token ${tokenData.status}` };
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      await this.updateTokenStatus(tokenData.id, 'expired');
      await this.logAccess(
        shareData?.id,
        tokenData.id,
        'validate',
        'expired',
        {},
        requestInfo,
      );
      return { valid: false, message: 'Token expirado' };
    }

    if (tokenData.uses_count >= tokenData.max_uses) {
      await this.updateTokenStatus(tokenData.id, 'consumed');
      await this.logAccess(
        shareData?.id,
        tokenData.id,
        'validate',
        'consumed',
        {},
        requestInfo,
      );
      return { valid: false, message: 'Token ja utilizado' };
    }

    if (!shareData || shareData.status !== 'active') {
      await this.logAccess(
        shareData?.id,
        tokenData.id,
        'validate',
        'revoked',
        {},
        requestInfo,
      );
      return { valid: false, message: 'Compartilhamento revogado ou inativo' };
    }

    if (new Date(shareData.expires_at) < new Date()) {
      await this.updateShareStatus(shareData.id, 'expired');
      await this.logAccess(
        shareData.id,
        tokenData.id,
        'validate',
        'expired',
        {},
        requestInfo,
      );
      return { valid: false, message: 'Compartilhamento expirado' };
    }

    if (shareData.access_count >= shareData.max_accesses) {
      await this.updateShareStatus(shareData.id, 'consumed');
      await this.logAccess(
        shareData.id,
        tokenData.id,
        'validate',
        'consumed',
        {},
        requestInfo,
      );
      return { valid: false, message: 'Limite de acessos atingido' };
    }

    const { data: snapshot } = await this.supabase
      .from('academic_record_snapshots')
      .select('*')
      .eq('id', shareData.snapshot_id)
      .is('deleted_at', null)
      .single();

    if (!snapshot || snapshot.status === 'revoked') {
      await this.logAccess(
        shareData.id,
        tokenData.id,
        'validate',
        'denied',
        { reason: 'snapshot_revoked' },
        requestInfo,
      );
      return { valid: false, message: 'Snapshot nao disponivel' };
    }

    const now = new Date().toISOString();
    await this.supabase
      .from('data_share_tokens')
      .update({ uses_count: tokenData.uses_count + 1, last_used_at: now })
      .eq('id', tokenData.id);

    await this.supabase
      .from('data_shares')
      .update({
        access_count: shareData.access_count + 1,
        first_accessed_at: shareData.first_accessed_at ?? now,
        last_accessed_at: now,
      })
      .eq('id', shareData.id);

    await this.logAccess(
      shareData.id,
      tokenData.id,
      'read',
      'allowed',
      {},
      requestInfo,
    );

    this.logger.log('Token validated', 'DataSharesService', {
      shareId: shareData.id,
    });
    return { valid: true, snapshot: snapshot as AcademicRecordSnapshot };
  }

  private async updateTokenStatus(
    tokenId: string,
    status: string,
  ): Promise<void> {
    await this.supabase
      .from('data_share_tokens')
      .update({ status })
      .eq('id', tokenId);
  }

  private async updateShareStatus(
    shareId: string,
    status: string,
  ): Promise<void> {
    await this.supabase
      .from('data_shares')
      .update({ status })
      .eq('id', shareId);
  }

  async findAccessLogs(
    shareId: string,
    tenantId: string,
  ): Promise<DataShareAccessLog[]> {
    const share = await this.findOne(shareId, tenantId);
    if (!share) {
      throw new NotFoundException(
        `Data share com id '${shareId}' nao encontrado`,
      );
    }

    const { data, error } = await this.supabase
      .from('data_share_access_logs')
      .select('*')
      .eq('data_share_id', shareId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list access logs: ${error.message}`);
    }
    return (data || []) as DataShareAccessLog[];
  }

  private async logAccess(
    shareId: string | null,
    tokenId: string | null,
    action: string,
    result: string,
    details: Record<string, unknown>,
    requestInfo: {
      ip?: string;
      userAgent?: string;
      userId?: string;
      tenantId?: string;
    },
  ): Promise<void> {
    await this.supabase.from('data_share_access_logs').insert({
      data_share_id: shareId,
      token_id: tokenId,
      requester_user_id: requestInfo.userId ?? null,
      requester_tenant_id: requestInfo.tenantId ?? null,
      requester_ip: requestInfo.ip ?? null,
      requester_user_agent: requestInfo.userAgent ?? null,
      action,
      result,
      details,
      created_at: new Date().toISOString(),
    });
  }
}
