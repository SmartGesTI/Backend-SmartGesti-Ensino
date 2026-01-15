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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { CommunicationThreadsService } from './communication-threads.service';
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

@Controller('communication-threads')
@UseGuards(JwtAuthGuard)
export class CommunicationThreadsController {
  constructor(private readonly threadsService: CommunicationThreadsService) {}

  @Get()
  findAll(
    @Subdomain() tenantId: string,
    @Query('schoolId') schoolId?: string,
    @Query('threadType') threadType?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return this.threadsService.findAll(tenantId, {
      schoolId,
      threadType,
      category,
      status,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Subdomain() tenantId: string) {
    return this.threadsService.findOne(id, tenantId);
  }

  @Post()
  create(
    @Subdomain() tenantId: string,
    @Body() dto: CreateThreadDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.threadsService.create(tenantId, dto, userId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Subdomain() tenantId: string,
    @Body() dto: UpdateThreadDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.threadsService.update(id, tenantId, dto, userId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.threadsService.remove(id, tenantId, userId);
  }

  @Post(':id/schedule')
  schedule(
    @Param('id') id: string,
    @Subdomain() tenantId: string,
    @Body() dto: ScheduleThreadDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.threadsService.schedule(id, tenantId, dto, userId);
  }

  @Post(':id/send')
  send(
    @Param('id') id: string,
    @Subdomain() tenantId: string,
    @Body() dto: SendThreadDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.threadsService.send(id, tenantId, dto, userId);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.threadsService.cancel(id, tenantId, userId);
  }

  @Post(':id/archive')
  archive(
    @Param('id') id: string,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.threadsService.archive(id, tenantId, userId);
  }

  @Get(':id/messages')
  findMessages(@Param('id') threadId: string, @Subdomain() tenantId: string) {
    return this.threadsService.findMessages(threadId, tenantId);
  }

  @Post(':id/messages')
  addMessage(
    @Param('id') threadId: string,
    @Subdomain() tenantId: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.threadsService.addMessage(threadId, tenantId, dto, userId);
  }

  @Put(':id/messages/:messageId')
  updateMessage(
    @Param('id') threadId: string,
    @Param('messageId') messageId: string,
    @Subdomain() tenantId: string,
    @Body() dto: UpdateMessageDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.threadsService.updateMessage(
      threadId,
      messageId,
      tenantId,
      dto,
      userId,
    );
  }

  @Delete(':id/messages/:messageId')
  removeMessage(
    @Param('id') threadId: string,
    @Param('messageId') messageId: string,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.threadsService.removeMessage(
      threadId,
      messageId,
      tenantId,
      userId,
    );
  }

  @Get(':id/participants')
  findParticipants(
    @Param('id') threadId: string,
    @Subdomain() tenantId: string,
  ) {
    return this.threadsService.findParticipants(threadId, tenantId);
  }

  @Post(':id/participants')
  addParticipant(
    @Param('id') threadId: string,
    @Subdomain() tenantId: string,
    @Body() dto: AddParticipantDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.threadsService.addParticipant(threadId, tenantId, dto, userId);
  }

  @Put(':id/participants/:participantId')
  updateParticipant(
    @Param('id') threadId: string,
    @Param('participantId') participantId: string,
    @Subdomain() tenantId: string,
    @Body() dto: UpdateParticipantDto,
  ) {
    return this.threadsService.updateParticipant(
      threadId,
      participantId,
      tenantId,
      dto,
    );
  }

  @Delete(':id/participants/:participantId')
  removeParticipant(
    @Param('id') threadId: string,
    @Param('participantId') participantId: string,
    @Subdomain() tenantId: string,
  ) {
    return this.threadsService.removeParticipant(
      threadId,
      participantId,
      tenantId,
    );
  }

  @Get(':id/links')
  findLinks(@Param('id') threadId: string, @Subdomain() tenantId: string) {
    return this.threadsService.findLinks(threadId, tenantId);
  }

  @Post(':id/links')
  addLink(
    @Param('id') threadId: string,
    @Subdomain() tenantId: string,
    @Body() dto: CreateThreadLinkDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.threadsService.addLink(threadId, tenantId, dto, userId);
  }

  @Delete(':id/links/:linkId')
  removeLink(
    @Param('id') threadId: string,
    @Param('linkId') linkId: string,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.threadsService.removeLink(threadId, linkId, tenantId, userId);
  }
}
