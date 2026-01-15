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
import { PreEnrollmentReviewsService } from './pre-enrollment-reviews.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreatePreEnrollmentReviewDto } from './dto/create-pre-enrollment-review.dto';
import { PreEnrollmentReview } from '../common/types';

@Controller('pre-enrollment-reviews')
@UseGuards(JwtAuthGuard)
export class PreEnrollmentReviewsController {
  constructor(
    private service: PreEnrollmentReviewsService,
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
    @Query('applicationId') applicationId?: string,
    @Query('reviewType') reviewType?: string,
    @Query('actorType') actorType?: string,
  ): Promise<PreEnrollmentReview[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      applicationId,
      reviewType,
      actorType,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreEnrollmentReview> {
    const tenantId = await this.getTenantId(subdomain);
    const review = await this.service.findOne(id, tenantId);

    if (!review) {
      throw new NotFoundException(`Review com id '${id}' não encontrado`);
    }

    return review;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreatePreEnrollmentReviewDto,
  ): Promise<PreEnrollmentReview> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Creating pre-enrollment review',
      'PreEnrollmentReviewsController',
      {
        userSub: user.sub,
        type: dto.review_type,
      },
    );

    return this.service.create(tenantId, dto, dbUser?.id);
  }

  @Post('ai-intake')
  async createAIIntake(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body()
    body: {
      applicationId: string;
      score?: number;
      missingFields?: unknown[];
      flags?: unknown[];
      recommendations?: unknown[];
      summary?: string;
      structuredOutput?: Record<string, unknown>;
    },
  ): Promise<PreEnrollmentReview> {
    const tenantId = await this.getTenantId(subdomain);

    if (!body.applicationId) {
      throw new BadRequestException('applicationId é obrigatório');
    }

    this.logger.log(
      'Creating AI intake review',
      'PreEnrollmentReviewsController',
      {
        userSub: user.sub,
        applicationId: body.applicationId,
      },
    );

    return this.service.createAIIntake(tenantId, body.applicationId, {
      score: body.score,
      missingFields: body.missingFields,
      flags: body.flags,
      recommendations: body.recommendations,
      summary: body.summary,
      structuredOutput: body.structuredOutput,
    });
  }

  @Post('duplicate-check')
  async createDuplicateCheck(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body()
    body: {
      applicationId: string;
      score?: number;
      flags?: unknown[];
      summary?: string;
      structuredOutput?: Record<string, unknown>;
    },
  ): Promise<PreEnrollmentReview> {
    const tenantId = await this.getTenantId(subdomain);

    if (!body.applicationId) {
      throw new BadRequestException('applicationId é obrigatório');
    }

    this.logger.log(
      'Creating duplicate check review',
      'PreEnrollmentReviewsController',
      {
        userSub: user.sub,
        applicationId: body.applicationId,
      },
    );

    return this.service.createDuplicateCheck(tenantId, body.applicationId, {
      score: body.score,
      flags: body.flags,
      summary: body.summary,
      structuredOutput: body.structuredOutput,
    });
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    await this.service.remove(id, tenantId);

    return { message: 'Review removido com sucesso' };
  }
}
