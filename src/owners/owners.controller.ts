import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OwnersService, Owner } from './owners.service';
import { ServiceKeyGuard } from '../auth/service-key.guard';
import { AddOwnerDto } from './dto/add-owner.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';

@Controller('tenants/:tenantId/owners')
@UseGuards(ServiceKeyGuard)
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  /**
   * Adiciona um proprietário a uma instituição
   * POST /api/tenants/:tenantId/owners
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async addOwner(
    @Param('tenantId') tenantId: string,
    @Body() addOwnerDto: AddOwnerDto,
  ): Promise<Owner> {
    return this.ownersService.addOwner(
      tenantId,
      addOwnerDto.user_email,
      addOwnerDto.ownership_level || 'owner',
    );
  }

  /**
   * Lista todos os proprietários de uma instituição
   * GET /api/tenants/:tenantId/owners
   */
  @Get()
  async listOwners(@Param('tenantId') tenantId: string): Promise<Owner[]> {
    return this.ownersService.listOwners(tenantId);
  }

  /**
   * Remove um proprietário de uma instituição
   * DELETE /api/tenants/:tenantId/owners/:userId
   */
  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeOwner(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.ownersService.removeOwner(tenantId, userId);
  }

  /**
   * Atualiza o nível de propriedade de um owner
   * PATCH /api/tenants/:tenantId/owners/:userId
   */
  @Patch(':userId')
  async updateOwnershipLevel(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Body() updateOwnerDto: UpdateOwnerDto,
  ): Promise<Owner> {
    return this.ownersService.updateOwnershipLevel(
      tenantId,
      userId,
      updateOwnerDto.ownership_level,
    );
  }
}
