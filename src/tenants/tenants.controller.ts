import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  NotFoundException,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { Tenant } from '../common/types';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { ServiceKeyGuard } from '../auth/service-key.guard';

@Controller('tenants')
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  // Endpoint público para buscar por subdomain (usado no login)
  @Get(':subdomain')
  async getTenantBySubdomain(@Param('subdomain') subdomain: string): Promise<Tenant> {
    try {
      const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);

      if (!tenant) {
        throw new NotFoundException(`Tenant with subdomain '${subdomain}' not found`);
      }

      return tenant;
    } catch (error: any) {
      // Se for erro de conexão, retornar erro mais amigável
      if (error.message?.includes('connection failed') || error.message?.includes('fetch failed')) {
        throw new InternalServerErrorException(
          'Database connection failed. Please check your Supabase configuration and ensure the migration has been executed.',
        );
      }
      throw error;
    }
  }

  // Listar todos os tenants (JWT)
  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllTenants(): Promise<Tenant[]> {
    try {
      return await this.tenantsService.getAllTenants();
    } catch (error: any) {
      if (error.message?.includes('connection failed') || error.message?.includes('fetch failed')) {
        throw new InternalServerErrorException(
          'Database connection failed. Please check your Supabase configuration.',
        );
      }
      throw error;
    }
  }

  // Buscar tenant por ID (JWT)
  @Get('id/:id')
  @UseGuards(JwtAuthGuard)
  async getTenantById(@Param('id') id: string): Promise<Tenant> {
    try {
      const tenant = await this.tenantsService.getTenantById(id);

      if (!tenant) {
        throw new NotFoundException(`Tenant with id '${id}' not found`);
      }

      return tenant;
    } catch (error: any) {
      if (error.message?.includes('connection failed') || error.message?.includes('fetch failed')) {
        throw new InternalServerErrorException(
          'Database connection failed. Please check your Supabase configuration.',
        );
      }
      throw error;
    }
  }

  // Criar tenant (Service Key)
  @Post()
  @UseGuards(ServiceKeyGuard)
  async createTenant(@Body() createTenantDto: CreateTenantDto): Promise<Tenant> {
    try {
      return await this.tenantsService.createTenant(createTenantDto);
    } catch (error: any) {
      if (error.message?.includes('connection failed') || error.message?.includes('fetch failed')) {
        throw new InternalServerErrorException(
          'Database connection failed. Please check your Supabase configuration.',
        );
      }
      throw error;
    }
  }

  // Atualizar tenant (Service Key)
  @Put(':id')
  @UseGuards(ServiceKeyGuard)
  async updateTenant(
    @Param('id') id: string,
    @Body() updateTenantDto: UpdateTenantDto,
  ): Promise<Tenant> {
    try {
      return await this.tenantsService.updateTenant(id, updateTenantDto);
    } catch (error: any) {
      if (error.message?.includes('connection failed') || error.message?.includes('fetch failed')) {
        throw new InternalServerErrorException(
          'Database connection failed. Please check your Supabase configuration.',
        );
      }
      throw error;
    }
  }

  // Deletar tenant (Service Key)
  @Delete(':id')
  @UseGuards(ServiceKeyGuard)
  async deleteTenant(@Param('id') id: string): Promise<{ message: string }> {
    try {
      await this.tenantsService.deleteTenant(id);
      return { message: `Tenant with id '${id}' deleted successfully` };
    } catch (error: any) {
      if (error.message?.includes('connection failed') || error.message?.includes('fetch failed')) {
        throw new InternalServerErrorException(
          'Database connection failed. Please check your Supabase configuration.',
        );
      }
      throw error;
    }
  }
}
