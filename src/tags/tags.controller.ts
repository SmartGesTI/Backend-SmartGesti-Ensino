import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { TagsService, Tag } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { TenantIdInterceptor } from '../common/interceptors/tenant-id.interceptor';

@Controller('tags')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantIdInterceptor)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  /**
   * Lista todas as tags do tenant
   * GET /api/tags?category=agent&search=texto
   */
  @Get()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ): Promise<Tag[]> {
    return this.tagsService.findAll(tenantId, { category, search });
  }

  /**
   * Busca uma tag por ID
   * GET /api/tags/:id
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ): Promise<Tag> {
    return this.tagsService.findOne(id, tenantId);
  }

  /**
   * Cria uma nova tag
   * POST /api/tags
   */
  @Post()
  async create(
    @Body() createTagDto: CreateTagDto,
    @Headers('x-tenant-id') tenantId: string,
  ): Promise<Tag> {
    return this.tagsService.create(tenantId, createTagDto);
  }

  /**
   * Busca ou cria uma tag (útil para autocomplete)
   * POST /api/tags/find-or-create
   */
  @Post('find-or-create')
  async findOrCreate(
    @Body() body: { name: string; category?: string },
    @Headers('x-tenant-id') tenantId: string,
  ): Promise<Tag> {
    return this.tagsService.findOrCreate(
      tenantId,
      body.name,
      body.category || 'general',
    );
  }

  /**
   * Atualiza uma tag
   * PUT /api/tags/:id
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateTagDto: UpdateTagDto,
    @Headers('x-tenant-id') tenantId: string,
  ): Promise<Tag> {
    return this.tagsService.update(id, tenantId, updateTagDto);
  }

  /**
   * Remove uma tag
   * DELETE /api/tags/:id
   */
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ): Promise<{ success: boolean }> {
    await this.tagsService.remove(id, tenantId);
    return { success: true };
  }
}
