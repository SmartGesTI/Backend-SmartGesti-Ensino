import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  SchoolDocumentsService,
  SchoolDocumentWithRelations,
} from './school-documents.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreateSchoolDocumentDto,
  UpdateSchoolDocumentDto,
  IssueDocumentDto,
  CancelDocumentDto,
} from './dto/create-school-document.dto';
import { CreateDocumentFileDto } from './dto/create-document-file.dto';
import { SchoolDocument, SchoolDocumentFile } from '../common/types';

@Controller('school-documents')
@UseGuards(JwtAuthGuard)
export class SchoolDocumentsController {
  constructor(
    private documentsService: SchoolDocumentsService,
    private usersService: UsersService,
    private tenantsService: TenantsService,
    private logger: LoggerService,
  ) {}

  private async getTenantId(subdomain: string | undefined): Promise<string> {
    if (!subdomain) {
      throw new BadRequestException('Subdomain e obrigatorio');
    }

    const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);
    if (!tenant) {
      throw new NotFoundException('Tenant nao encontrado');
    }

    return tenant.id;
  }

  // ============================================
  // CRUD Principal
  // ============================================

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('schoolId') schoolId?: string,
    @Query('documentTypeId') documentTypeId?: string,
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
    @Query('visibility') visibility?: string,
  ): Promise<SchoolDocument[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.documentsService.findAll(tenantId, {
      schoolId,
      documentTypeId,
      studentId,
      status,
      visibility,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SchoolDocumentWithRelations> {
    const tenantId = await this.getTenantId(subdomain);
    const doc = await this.documentsService.findOne(id, tenantId);

    if (!doc) {
      throw new NotFoundException(`Documento com id '${id}' nao encontrado`);
    }

    return doc;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateSchoolDocumentDto,
  ): Promise<SchoolDocument> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Creating document', 'SchoolDocumentsController', {
      userSub: user.sub,
      title: dto.title,
    });

    return this.documentsService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSchoolDocumentDto,
  ): Promise<SchoolDocument> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.documentsService.update(id, tenantId, dto, dbUser?.id);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    await this.documentsService.remove(id, tenantId, dbUser?.id);

    return { success: true };
  }

  // ============================================
  // Acoes Especiais
  // ============================================

  @Post(':id/issue')
  async issue(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueDocumentDto,
  ): Promise<SchoolDocument> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Issuing document', 'SchoolDocumentsController', {
      userSub: user.sub,
      documentId: id,
    });

    return this.documentsService.issue(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/lock')
  async lock(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SchoolDocument> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.documentsService.lock(id, tenantId, dbUser?.id);
  }

  @Post(':id/cancel')
  async cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelDocumentDto,
  ): Promise<SchoolDocument> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Cancelling document', 'SchoolDocumentsController', {
      userSub: user.sub,
      documentId: id,
      reason: dto.reason,
    });

    return this.documentsService.cancel(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/archive')
  async archive(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SchoolDocument> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.documentsService.archive(id, tenantId, dbUser?.id);
  }

  // ============================================
  // Arquivos
  // ============================================

  @Get(':id/files')
  async findFiles(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SchoolDocumentFile[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.documentsService.findFiles(id, tenantId);
  }

  @Post(':id/files')
  async addFile(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDocumentFileDto,
  ): Promise<SchoolDocumentFile> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.documentsService.addFile(id, tenantId, dto, dbUser?.id);
  }

  @Delete(':id/files/:fileId')
  async removeFile(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<{ success: boolean }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    await this.documentsService.removeFile(id, fileId, tenantId, dbUser?.id);

    return { success: true };
  }

  // ============================================
  // Destinatarios
  // ============================================

  @Get(':id/recipients')
  async findRecipients(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<any[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.documentsService.findRecipients(id, tenantId);
  }

  @Post(':id/recipients')
  async addRecipient(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ): Promise<any> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.documentsService.addRecipient(id, tenantId, dto, dbUser?.id);
  }

  @Put(':id/recipients/:recipientId')
  async updateRecipient(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recipientId', ParseUUIDPipe) recipientId: string,
    @Body() dto: any,
  ): Promise<any> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.documentsService.updateRecipient(
      id,
      recipientId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Delete(':id/recipients/:recipientId')
  async removeRecipient(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recipientId', ParseUUIDPipe) recipientId: string,
  ): Promise<{ success: boolean }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    await this.documentsService.removeRecipient(
      id,
      recipientId,
      tenantId,
      dbUser?.id,
    );

    return { success: true };
  }

  @Post(':id/recipients/:recipientId/deliver')
  async deliverToRecipient(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recipientId', ParseUUIDPipe) recipientId: string,
    @Body() dto: any,
  ): Promise<any> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.documentsService.deliverToRecipient(
      id,
      recipientId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Post(':id/recipients/:recipientId/acknowledge')
  async acknowledgeRecipient(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recipientId', ParseUUIDPipe) recipientId: string,
    @Body() dto: any,
  ): Promise<any> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.documentsService.acknowledgeRecipient(
      id,
      recipientId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }
}
