import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PreEnrollmentAttachmentsService } from './pre-enrollment-attachments.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreatePreEnrollmentAttachmentDto } from './dto/create-pre-enrollment-attachment.dto';
import { PreEnrollmentAttachment } from '../common/types';

@Controller('pre-enrollment-attachments')
@UseGuards(JwtAuthGuard)
export class PreEnrollmentAttachmentsController {
  constructor(
    private service: PreEnrollmentAttachmentsService,
    private usersService: UsersService,
    private tenantsService: TenantsService,
    private logger: LoggerService,
  ) {}

  private async getTenantId(subdomain: string | undefined): Promise<string> {
    if (!subdomain) {
      throw new BadRequestException('Subdomain é obrigatório');
    }

    const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);
    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado');
    }

    return tenant.id;
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('schoolId') schoolId?: string,
    @Query('householdId') householdId?: string,
    @Query('applicationId') applicationId?: string,
    @Query('personId') personId?: string,
    @Query('category') category?: string,
  ): Promise<PreEnrollmentAttachment[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      schoolId,
      householdId,
      applicationId,
      personId,
      category,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreEnrollmentAttachment> {
    const tenantId = await this.getTenantId(subdomain);
    const attachment = await this.service.findOne(id, tenantId);

    if (!attachment) {
      throw new NotFoundException(`Attachment com id '${id}' não encontrado`);
    }

    return attachment;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreatePreEnrollmentAttachmentDto,
  ): Promise<PreEnrollmentAttachment> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Creating pre-enrollment attachment',
      'PreEnrollmentAttachmentsController',
      {
        userSub: user.sub,
        category: dto.category,
      },
    );

    return this.service.create(tenantId, dto, dbUser?.id);
  }

  @Post('upload')
  async upload(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreatePreEnrollmentAttachmentDto,
  ): Promise<PreEnrollmentAttachment> {
    // Este endpoint pode ser estendido para upload direto de arquivos
    // Por enquanto, registra o attachment após upload feito externamente (ex: Supabase Storage)
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Uploading pre-enrollment attachment',
      'PreEnrollmentAttachmentsController',
      {
        userSub: user.sub,
        category: dto.category,
      },
    );

    return this.service.create(tenantId, dto, dbUser?.id);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    await this.service.remove(id, tenantId);

    return { message: 'Attachment removido com sucesso' };
  }
}
