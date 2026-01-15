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
  ParseUUIDPipe,
} from '@nestjs/common';
import { PersonsService } from './persons.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { CreatePersonDocumentDto } from './dto/create-person-document.dto';
import {
  CreatePersonAddressDto,
  UpdatePersonAddressDto,
} from './dto/create-person-address.dto';
import {
  CreatePersonContactDto,
  UpdatePersonContactDto,
} from './dto/create-person-contact.dto';
import {
  Person,
  PersonDocument,
  PersonWithDocuments,
  PaginatedResult,
  Address,
  PersonAddress,
  PersonContact,
} from '../common/types';

@Controller('persons')
@UseGuards(JwtAuthGuard)
export class PersonsController {
  constructor(
    private personsService: PersonsService,
    private usersService: UsersService,
    private logger: LoggerService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ): Promise<PaginatedResult<Person>> {
    this.logger.log('Listing persons', 'PersonsController', {
      userSub: user.sub,
      page,
      limit,
      search,
    });

    return this.personsService.findAll(page || 1, limit || 20, search);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PersonWithDocuments> {
    const person = await this.personsService.findOne(id);

    if (!person) {
      throw new NotFoundException(`Pessoa com id '${id}' não encontrada`);
    }

    return person;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() createPersonDto: CreatePersonDto,
  ): Promise<Person> {
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Creating person', 'PersonsController', {
      userSub: user.sub,
      name: createPersonDto.full_name,
    });

    return this.personsService.create(createPersonDto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePersonDto: UpdatePersonDto,
  ): Promise<Person> {
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Updating person', 'PersonsController', {
      userSub: user.sub,
      personId: id,
    });

    return this.personsService.update(id, updatePersonDto, dbUser?.id);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    this.logger.log('Deleting person', 'PersonsController', {
      userSub: user.sub,
      personId: id,
    });

    await this.personsService.remove(id, dbUser.id);

    return { message: `Pessoa com id '${id}' removida com sucesso` };
  }

  // ============================================
  // Documents Endpoints
  // ============================================

  @Get(':id/documents')
  async findDocuments(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PersonDocument[]> {
    // Verificar se pessoa existe
    const person = await this.personsService.findOne(id);
    if (!person) {
      throw new NotFoundException(`Pessoa com id '${id}' não encontrada`);
    }

    return this.personsService.findDocuments(id);
  }

  @Post(':id/documents')
  async addDocument(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createDocumentDto: CreatePersonDocumentDto,
  ): Promise<PersonDocument> {
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Adding document to person', 'PersonsController', {
      userSub: user.sub,
      personId: id,
      docType: createDocumentDto.doc_type,
    });

    return this.personsService.addDocument(id, createDocumentDto, dbUser?.id);
  }

  @Delete(':personId/documents/:documentId')
  async removeDocument(
    @CurrentUser() user: CurrentUserPayload,
    @Param('personId', ParseUUIDPipe) personId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<{ message: string }> {
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    this.logger.log('Removing document from person', 'PersonsController', {
      userSub: user.sub,
      personId,
      documentId,
    });

    await this.personsService.removeDocument(personId, documentId, dbUser.id);

    return { message: `Documento removido com sucesso` };
  }

  // ============================================
  // Search by Document
  // ============================================

  @Get('search/by-document')
  async findByDocument(
    @CurrentUser() user: CurrentUserPayload,
    @Query('type') docType: string,
    @Query('value') docValue: string,
  ): Promise<Person | null> {
    if (!docType || !docValue) {
      throw new NotFoundException('Tipo e valor do documento são obrigatórios');
    }

    return this.personsService.findByDocument(docType, docValue);
  }

  // ============================================
  // Addresses Endpoints
  // ============================================

  @Get(':id/addresses')
  async findAddresses(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<(PersonAddress & { address: Address })[]> {
    const person = await this.personsService.findOne(id);
    if (!person) {
      throw new NotFoundException(`Pessoa com id '${id}' não encontrada`);
    }

    return this.personsService.findAddresses(id);
  }

  @Post(':id/addresses')
  async addAddress(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePersonAddressDto,
  ): Promise<PersonAddress & { address: Address }> {
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Adding address to person', 'PersonsController', {
      userSub: user.sub,
      personId: id,
      addressType: dto.address_type,
    });

    return this.personsService.addAddress(id, dto, dbUser?.id);
  }

  @Put(':personId/addresses/:addressId')
  async updateAddress(
    @CurrentUser() user: CurrentUserPayload,
    @Param('personId', ParseUUIDPipe) personId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdatePersonAddressDto,
  ): Promise<PersonAddress & { address: Address }> {
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Updating address', 'PersonsController', {
      userSub: user.sub,
      personId,
      addressId,
    });

    return this.personsService.updateAddress(
      personId,
      addressId,
      dto,
      dbUser?.id,
    );
  }

  @Delete(':personId/addresses/:addressId')
  async removeAddress(
    @CurrentUser() user: CurrentUserPayload,
    @Param('personId', ParseUUIDPipe) personId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ): Promise<{ message: string }> {
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    this.logger.log('Removing address from person', 'PersonsController', {
      userSub: user.sub,
      personId,
      addressId,
    });

    await this.personsService.removeAddress(personId, addressId, dbUser.id);

    return { message: 'Endereço removido com sucesso' };
  }

  // ============================================
  // Contacts Endpoints
  // ============================================

  @Get(':id/contacts')
  async findContacts(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PersonContact[]> {
    const person = await this.personsService.findOne(id);
    if (!person) {
      throw new NotFoundException(`Pessoa com id '${id}' não encontrada`);
    }

    return this.personsService.findContacts(id);
  }

  @Post(':id/contacts')
  async addContact(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePersonContactDto,
  ): Promise<PersonContact> {
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Adding contact to person', 'PersonsController', {
      userSub: user.sub,
      personId: id,
      contactType: dto.contact_type,
    });

    return this.personsService.addContact(id, dto, dbUser?.id);
  }

  @Put(':personId/contacts/:contactId')
  async updateContact(
    @CurrentUser() user: CurrentUserPayload,
    @Param('personId', ParseUUIDPipe) personId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdatePersonContactDto,
  ): Promise<PersonContact> {
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Updating contact', 'PersonsController', {
      userSub: user.sub,
      personId,
      contactId,
    });

    return this.personsService.updateContact(
      personId,
      contactId,
      dto,
      dbUser?.id,
    );
  }

  @Delete(':personId/contacts/:contactId')
  async removeContact(
    @CurrentUser() user: CurrentUserPayload,
    @Param('personId', ParseUUIDPipe) personId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ): Promise<{ message: string }> {
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    this.logger.log('Removing contact from person', 'PersonsController', {
      userSub: user.sub,
      personId,
      contactId,
    });

    await this.personsService.removeContact(personId, contactId, dbUser.id);

    return { message: 'Contato removido com sucesso' };
  }
}
