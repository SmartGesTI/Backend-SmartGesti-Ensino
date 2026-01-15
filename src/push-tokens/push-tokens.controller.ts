import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { PushTokensService } from './push-tokens.service';
import { RegisterTokenDto } from './dto/push-token.dto';

@Controller('push-tokens')
@UseGuards(JwtAuthGuard)
export class PushTokensController {
  constructor(private readonly pushTokensService: PushTokensService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string, @Subdomain() tenantId: string) {
    return this.pushTokensService.findAll(userId, tenantId);
  }

  @Post()
  register(
    @CurrentUser('id') userId: string,
    @Subdomain() tenantId: string,
    @Body() dto: RegisterTokenDto,
  ) {
    return this.pushTokensService.register(userId, tenantId, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Subdomain() tenantId: string,
  ) {
    return this.pushTokensService.remove(id, userId, tenantId);
  }
}
