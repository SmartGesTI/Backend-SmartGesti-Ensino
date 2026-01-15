import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { LeaderboardSnapshot } from '../common/types';
import {
  CreateLeaderboardSnapshotDto,
  ComputeLeaderboardSnapshotDto,
} from './dto/create-leaderboard-snapshot.dto';

@Injectable()
export class LeaderboardSnapshotsService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async findAll(
    tenantId: string,
    options?: { leaderboardDefinitionId?: string; limit?: number },
  ): Promise<LeaderboardSnapshot[]> {
    let query = this.supabase
      .from('leaderboard_snapshots')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('computed_at', { ascending: false });
    if (options?.leaderboardDefinitionId)
      query = query.eq(
        'leaderboard_definition_id',
        options.leaderboardDefinitionId,
      );
    if (options?.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error)
      throw new Error(`Failed to list leaderboard snapshots: ${error.message}`);
    return (data || []) as LeaderboardSnapshot[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<LeaderboardSnapshot | null> {
    const { data, error } = await this.supabase
      .from('leaderboard_snapshots')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get leaderboard snapshot: ${error.message}`);
    }
    return data as LeaderboardSnapshot;
  }

  async getLatest(
    leaderboardDefinitionId: string,
    tenantId: string,
  ): Promise<LeaderboardSnapshot | null> {
    const { data, error } = await this.supabase
      .from('leaderboard_snapshots')
      .select('*')
      .eq('leaderboard_definition_id', leaderboardDefinitionId)
      .eq('tenant_id', tenantId)
      .order('computed_at', { ascending: false })
      .limit(1)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get latest snapshot: ${error.message}`);
    }
    return data as LeaderboardSnapshot;
  }

  async create(
    tenantId: string,
    dto: CreateLeaderboardSnapshotDto,
    userId?: string,
  ): Promise<LeaderboardSnapshot> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('leaderboard_snapshots')
      .insert({
        tenant_id: tenantId,
        leaderboard_definition_id: dto.leaderboard_definition_id,
        computed_at: now,
        as_of_date: dto.as_of_date ?? null,
        entries_count: dto.entries_count ?? 0,
        cohort_size: dto.cohort_size ?? 0,
        metadata: dto.metadata ?? {},
        created_at: now,
        created_by: userId ?? null,
      })
      .select()
      .single();
    if (error)
      throw new Error(
        `Failed to create leaderboard snapshot: ${error.message}`,
      );
    this.logger.log(
      'Leaderboard snapshot created',
      'LeaderboardSnapshotsService',
      { id: data.id },
    );
    return data as LeaderboardSnapshot;
  }

  async compute(
    tenantId: string,
    dto: ComputeLeaderboardSnapshotDto,
    userId?: string,
  ): Promise<LeaderboardSnapshot> {
    // TODO: Implementar lógica real de cálculo do ranking
    this.logger.log(
      'Computing leaderboard snapshot',
      'LeaderboardSnapshotsService',
      { leaderboardDefinitionId: dto.leaderboard_definition_id },
    );

    // Por enquanto, apenas cria um snapshot vazio
    return this.create(
      tenantId,
      {
        leaderboard_definition_id: dto.leaderboard_definition_id,
        as_of_date: dto.as_of_date,
        entries_count: 0,
        cohort_size: 0,
      },
      userId,
    );
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Leaderboard snapshot com id '${id}' não encontrado`,
      );
    const { error } = await this.supabase
      .from('leaderboard_snapshots')
      .delete()
      .eq('id', id);
    if (error)
      throw new Error(
        `Failed to delete leaderboard snapshot: ${error.message}`,
      );
  }
}
