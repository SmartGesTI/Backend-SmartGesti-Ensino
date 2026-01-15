import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { CommunicationAttachmentsService } from './communication-attachments.service';
import {
  CreateAttachmentDto,
  AttachToMessageDto,
} from './dto/create-attachment.dto';

@Controller('communication-attachments')
@UseGuards(JwtAuthGuard)
export class CommunicationAttachmentsController {
  constructor(
    private readonly attachmentsService: CommunicationAttachmentsService,
  ) {}

  @Get()
  findAll(@Subdomain() tenantId: string, @Query('schoolId') schoolId?: string) {
    return this.attachmentsService.findAll(tenantId, { schoolId });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Subdomain() tenantId: string) {
    return this.attachmentsService.findOne(id, tenantId);
  }

  @Post()
  upload(
    @Subdomain() tenantId: string,
    @Body() dto: CreateAttachmentDto,
    @CurrentUser('id') userId: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.attachmentsService.upload(
      tenantId,
      schoolId || null,
      dto,
      userId,
    );
  }

  @Post(':id/attach')
  attachToMessage(
    @Param('id') id: string,
    @Subdomain() tenantId: string,
    @Body() dto: AttachToMessageDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.attachmentsService.attachToMessage(id, tenantId, dto, userId);
  }

  @Delete(':id/messages/:messageId')
  detachFromMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attachmentsService.detachFromMessage(
      id,
      messageId,
      tenantId,
      userId,
    );
  }

  @Get('message/:messageId')
  findByMessage(
    @Param('messageId') messageId: string,
    @Subdomain() tenantId: string,
  ) {
    return this.attachmentsService.findByMessage(messageId, tenantId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attachmentsService.remove(id, tenantId, userId);
  }
}
