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
import { NotificationsService } from './notifications.service';
import {
  CreateNotificationRuleDto,
  MarkReadDto,
  UpdatePreferencesDto,
} from './dto/notification.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('notification-rules')
  findRules(
    @Subdomain() tenantId: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.notificationsService.findRules(tenantId, schoolId);
  }

  @Get('notification-rules/:id')
  findRule(@Param('id') id: string, @Subdomain() tenantId: string) {
    return this.notificationsService.findRule(id, tenantId);
  }

  @Post('notification-rules')
  createRule(
    @Subdomain() tenantId: string,
    @Body() dto: CreateNotificationRuleDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.createRule(tenantId, dto, userId);
  }

  @Put('notification-rules/:id')
  updateRule(
    @Param('id') id: string,
    @Subdomain() tenantId: string,
    @Body() dto: Partial<CreateNotificationRuleDto>,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.updateRule(id, tenantId, dto, userId);
  }

  @Delete('notification-rules/:id')
  removeRule(
    @Param('id') id: string,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.removeRule(id, tenantId, userId);
  }

  @Get('notifications')
  findUserNotifications(
    @CurrentUser('id') userId: string,
    @Subdomain() tenantId: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.findUserNotifications(
      userId,
      tenantId,
      unreadOnly === 'true',
    );
  }

  @Get('notifications/unread-count')
  getUnreadCount(
    @CurrentUser('id') userId: string,
    @Subdomain() tenantId: string,
  ) {
    return this.notificationsService.getUnreadCount(userId, tenantId);
  }

  @Post('notifications/:id/read')
  markAsRead(
    @CurrentUser('id') userId: string,
    @Subdomain() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(userId, tenantId, {
      notification_ids: [id],
    });
  }

  @Post('notifications/read-all')
  markAllAsRead(
    @CurrentUser('id') userId: string,
    @Subdomain() tenantId: string,
  ) {
    return this.notificationsService.markAllAsRead(userId, tenantId);
  }

  @Get('notifications/preferences')
  getPreferences(
    @CurrentUser('id') userId: string,
    @Subdomain() tenantId: string,
  ) {
    return this.notificationsService.getPreferences(userId, tenantId);
  }

  @Put('notifications/preferences')
  updatePreferences(
    @CurrentUser('id') userId: string,
    @Subdomain() tenantId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(userId, tenantId, dto);
  }
}
