import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import {
  Person,
  PersonDocument,
  PersonWithDocuments,
  PaginatedResult,
  Address,
  PersonAddress,
  PersonContact,
} from '../common/types';
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

@Injectable()
export class PersonsService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  // ============================================
  // Persons CRUD
  // ============================================

  async findAll(
    page: number = 1,
    limit: number = 20,
    search?: string,
  ): Promise<PaginatedResult<Person>> {
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('persons')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('full_name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,preferred_name.ilike.%${search}%`,
      );
    }

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(
        `Failed to list persons: ${error.message}`,
        undefined,
        'PersonsService',
      );
      throw new Error(`Failed to list persons: ${error.message}`);
    }

    return {
      data: (data || []) as Person[],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async findOne(id: string): Promise<PersonWithDocuments | null> {
    const { data, error } = await this.supabase
      .from('persons')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(
        `Failed to get person: ${error.message}`,
        undefined,
        'PersonsService',
        { id },
      );
      throw new Error(`Failed to get person: ${error.message}`);
    }

    const person = data as Person;

    // Buscar documentos da pessoa
    const { data: documents } = await this.supabase
      .from('person_documents')
      .select('*')
      .eq('person_id', id)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false });

    return {
      ...person,
      documents: (documents || []) as PersonDocument[],
    };
  }

  async create(
    createPersonDto: CreatePersonDto,
    userId?: string,
  ): Promise<Person> {
    const { data, error } = await this.supabase
      .from('persons')
      .insert({
        ...createPersonDto,
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to create person: ${error.message}`,
        undefined,
        'PersonsService',
        {
          dto: createPersonDto,
        },
      );
      throw new Error(`Failed to create person: ${error.message}`);
    }

    this.logger.log('Person created', 'PersonsService', {
      personId: data.id,
      name: data.full_name,
    });

    return data as Person;
  }

  async update(
    id: string,
    updatePersonDto: UpdatePersonDto,
    userId?: string,
  ): Promise<Person> {
    const existing = await this.findOne(id);
    if (!existing) {
      throw new NotFoundException(`Pessoa com id '${id}' não encontrada`);
    }

    const { data, error } = await this.supabase
      .from('persons')
      .update({
        ...updatePersonDto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to update person: ${error.message}`,
        undefined,
        'PersonsService',
        { id },
      );
      throw new Error(`Failed to update person: ${error.message}`);
    }

    this.logger.log('Person updated', 'PersonsService', { personId: id });

    return data as Person;
  }

  async remove(id: string, userId: string): Promise<void> {
    const existing = await this.findOne(id);
    if (!existing) {
      throw new NotFoundException(`Pessoa com id '${id}' não encontrada`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'persons',
      id,
      userId,
    );

    if (!result.success) {
      this.logger.error(
        `Failed to delete person: ${result.error}`,
        undefined,
        'PersonsService',
        { id },
      );
      throw new Error(`Failed to delete person: ${result.error}`);
    }

    // Soft-delete documentos associados
    await this.supabase
      .from('person_documents')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('person_id', id)
      .is('deleted_at', null);

    this.logger.log('Person deleted (soft)', 'PersonsService', {
      personId: id,
    });
  }

  // ============================================
  // Person Documents CRUD
  // ============================================

  async findDocuments(personId: string): Promise<PersonDocument[]> {
    const { data, error } = await this.supabase
      .from('person_documents')
      .select('*')
      .eq('person_id', personId)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to list documents: ${error.message}`,
        undefined,
        'PersonsService',
        { personId },
      );
      throw new Error(`Failed to list documents: ${error.message}`);
    }

    return (data || []) as PersonDocument[];
  }

  async addDocument(
    personId: string,
    createDocumentDto: CreatePersonDocumentDto,
    userId?: string,
  ): Promise<PersonDocument> {
    // Verificar se pessoa existe
    const person = await this.findOne(personId);
    if (!person) {
      throw new NotFoundException(`Pessoa com id '${personId}' não encontrada`);
    }

    // Validar CPF (apenas números, 11 dígitos)
    if (createDocumentDto.doc_type === 'cpf') {
      const cleanedCpf = createDocumentDto.doc_value.replace(/\D/g, '');
      if (cleanedCpf.length !== 11) {
        throw new BadRequestException('CPF deve ter 11 dígitos');
      }
      createDocumentDto.doc_value = cleanedCpf;
    }

    // Se is_primary = true, remover primary de outros documentos do mesmo tipo
    if (createDocumentDto.is_primary) {
      await this.supabase
        .from('person_documents')
        .update({ is_primary: false })
        .eq('person_id', personId)
        .eq('doc_type', createDocumentDto.doc_type)
        .is('deleted_at', null);
    }

    const { data, error } = await this.supabase
      .from('person_documents')
      .insert({
        person_id: personId,
        ...createDocumentDto,
        is_primary: createDocumentDto.is_primary ?? false,
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      // Verificar duplicação
      if (error.code === '23505') {
        throw new ConflictException(
          `Documento ${createDocumentDto.doc_type} com valor '${createDocumentDto.doc_value}' já existe para esta pessoa`,
        );
      }
      this.logger.error(
        `Failed to add document: ${error.message}`,
        undefined,
        'PersonsService',
        { personId },
      );
      throw new Error(`Failed to add document: ${error.message}`);
    }

    this.logger.log('Document added to person', 'PersonsService', {
      personId,
      documentId: data.id,
      docType: createDocumentDto.doc_type,
    });

    return data as PersonDocument;
  }

  async removeDocument(
    personId: string,
    documentId: string,
    userId: string,
  ): Promise<void> {
    const { data: document } = await this.supabase
      .from('person_documents')
      .select('*')
      .eq('id', documentId)
      .eq('person_id', personId)
      .is('deleted_at', null)
      .single();

    if (!document) {
      throw new NotFoundException(
        `Documento com id '${documentId}' não encontrado`,
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'person_documents',
      documentId,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete document: ${result.error}`);
    }

    this.logger.log('Document deleted (soft)', 'PersonsService', {
      personId,
      documentId,
    });
  }

  // ============================================
  // Busca por documento
  // ============================================

  async findByDocument(
    docType: string,
    docValue: string,
  ): Promise<Person | null> {
    const cleanedValue = docValue.replace(/\D/g, '');

    const { data, error } = await this.supabase
      .from('person_documents')
      .select('person_id, persons!inner(*)')
      .eq('doc_type', docType)
      .eq('doc_value', cleanedValue)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return null;
    }

    return (data as any).persons as Person;
  }

  // ============================================
  // Person Addresses CRUD
  // ============================================

  async findAddresses(
    personId: string,
  ): Promise<(PersonAddress & { address: Address })[]> {
    const { data, error } = await this.supabase
      .from('person_addresses')
      .select('*, addresses(*)')
      .eq('person_id', personId)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to list addresses: ${error.message}`,
        undefined,
        'PersonsService',
        { personId },
      );
      throw new Error(`Failed to list addresses: ${error.message}`);
    }

    return (data || []).map((item: any) => ({
      ...item,
      address: item.addresses,
    }));
  }

  async addAddress(
    personId: string,
    dto: CreatePersonAddressDto,
    userId?: string,
  ): Promise<PersonAddress & { address: Address }> {
    const person = await this.findOne(personId);
    if (!person) {
      throw new NotFoundException(`Pessoa com id '${personId}' não encontrada`);
    }

    let addressId = dto.address_id;

    // Se não foi passado address_id, criar novo endereço
    if (!addressId) {
      const { data: newAddress, error: addressError } = await this.supabase
        .from('addresses')
        .insert({
          country_code: dto.country_code ?? 'BRA',
          postal_code: dto.postal_code ?? null,
          state: dto.state ?? null,
          city: dto.city ?? null,
          district: dto.district ?? null,
          street: dto.street ?? null,
          number: dto.number ?? null,
          complement: dto.complement ?? null,
          reference: dto.reference ?? null,
          metadata: dto.metadata ?? {},
        })
        .select()
        .single();

      if (addressError) {
        throw new Error(`Failed to create address: ${addressError.message}`);
      }

      addressId = newAddress.id;
    }

    // Se is_primary = true, remover primary de outros
    if (dto.is_primary) {
      await this.supabase
        .from('person_addresses')
        .update({ is_primary: false })
        .eq('person_id', personId)
        .is('deleted_at', null);
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('person_addresses')
      .insert({
        person_id: personId,
        address_id: addressId,
        address_type: dto.address_type,
        is_primary: dto.is_primary ?? false,
        valid_from: dto.valid_from ?? now.split('T')[0],
        valid_to: dto.valid_to ?? null,
        created_at: now,
        created_by: userId ?? null,
      })
      .select('*, addresses(*)')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'Este endereço já está vinculado a esta pessoa',
        );
      }
      throw new Error(`Failed to add address: ${error.message}`);
    }

    this.logger.log('Address added to person', 'PersonsService', {
      personId,
      addressId: data.address_id,
    });

    return {
      ...data,
      address: (data as any).addresses,
    };
  }

  async updateAddress(
    personId: string,
    personAddressId: string,
    dto: UpdatePersonAddressDto,
    userId?: string,
  ): Promise<PersonAddress & { address: Address }> {
    const { data: existing } = await this.supabase
      .from('person_addresses')
      .select('*, addresses(*)')
      .eq('id', personAddressId)
      .eq('person_id', personId)
      .is('deleted_at', null)
      .single();

    if (!existing) {
      throw new NotFoundException(
        `Endereço com id '${personAddressId}' não encontrado`,
      );
    }

    // Se is_primary = true, remover primary de outros
    if (dto.is_primary) {
      await this.supabase
        .from('person_addresses')
        .update({ is_primary: false })
        .eq('person_id', personId)
        .neq('id', personAddressId)
        .is('deleted_at', null);
    }

    // Atualizar person_address
    const personAddressUpdate: Record<string, unknown> = {};
    if (dto.address_type !== undefined)
      personAddressUpdate.address_type = dto.address_type;
    if (dto.is_primary !== undefined)
      personAddressUpdate.is_primary = dto.is_primary;
    if (dto.valid_to !== undefined) personAddressUpdate.valid_to = dto.valid_to;

    if (Object.keys(personAddressUpdate).length > 0) {
      await this.supabase
        .from('person_addresses')
        .update(personAddressUpdate)
        .eq('id', personAddressId);
    }

    // Atualizar address (se houver campos de endereço)
    const addressUpdate: Record<string, unknown> = {};
    if (dto.country_code !== undefined)
      addressUpdate.country_code = dto.country_code;
    if (dto.postal_code !== undefined)
      addressUpdate.postal_code = dto.postal_code;
    if (dto.state !== undefined) addressUpdate.state = dto.state;
    if (dto.city !== undefined) addressUpdate.city = dto.city;
    if (dto.district !== undefined) addressUpdate.district = dto.district;
    if (dto.street !== undefined) addressUpdate.street = dto.street;
    if (dto.number !== undefined) addressUpdate.number = dto.number;
    if (dto.complement !== undefined) addressUpdate.complement = dto.complement;
    if (dto.reference !== undefined) addressUpdate.reference = dto.reference;

    if (Object.keys(addressUpdate).length > 0) {
      addressUpdate.updated_at = new Date().toISOString();
      await this.supabase
        .from('addresses')
        .update(addressUpdate)
        .eq('id', existing.address_id);
    }

    // Buscar atualizado
    const { data } = await this.supabase
      .from('person_addresses')
      .select('*, addresses(*)')
      .eq('id', personAddressId)
      .single();

    this.logger.log('Address updated', 'PersonsService', {
      personId,
      personAddressId,
    });

    return {
      ...data,
      address: (data as any).addresses,
    };
  }

  async removeAddress(
    personId: string,
    personAddressId: string,
    userId: string,
  ): Promise<void> {
    const { data: existing } = await this.supabase
      .from('person_addresses')
      .select('*')
      .eq('id', personAddressId)
      .eq('person_id', personId)
      .is('deleted_at', null)
      .single();

    if (!existing) {
      throw new NotFoundException(
        `Endereço com id '${personAddressId}' não encontrado`,
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'person_addresses',
      personAddressId,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete address: ${result.error}`);
    }

    this.logger.log('Address removed from person', 'PersonsService', {
      personId,
      personAddressId,
    });
  }

  // ============================================
  // Person Contacts CRUD
  // ============================================

  async findContacts(personId: string): Promise<PersonContact[]> {
    const { data, error } = await this.supabase
      .from('person_contacts')
      .select('*')
      .eq('person_id', personId)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to list contacts: ${error.message}`,
        undefined,
        'PersonsService',
        { personId },
      );
      throw new Error(`Failed to list contacts: ${error.message}`);
    }

    return (data || []) as PersonContact[];
  }

  async addContact(
    personId: string,
    dto: CreatePersonContactDto,
    userId?: string,
  ): Promise<PersonContact> {
    const person = await this.findOne(personId);
    if (!person) {
      throw new NotFoundException(`Pessoa com id '${personId}' não encontrada`);
    }

    // Validar email
    if (dto.contact_type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(dto.value)) {
        throw new BadRequestException('Email inválido');
      }
    }

    // Validar telefone (limpar e verificar)
    if (dto.contact_type === 'phone' || dto.contact_type === 'whatsapp') {
      const cleanedPhone = dto.value.replace(/\D/g, '');
      if (cleanedPhone.length < 10 || cleanedPhone.length > 15) {
        throw new BadRequestException('Telefone inválido');
      }
      dto.value = cleanedPhone;
    }

    // Se is_primary = true, remover primary de outros do mesmo tipo
    if (dto.is_primary) {
      await this.supabase
        .from('person_contacts')
        .update({ is_primary: false })
        .eq('person_id', personId)
        .eq('contact_type', dto.contact_type)
        .is('deleted_at', null);
    }

    const { data, error } = await this.supabase
      .from('person_contacts')
      .insert({
        person_id: personId,
        contact_type: dto.contact_type,
        value: dto.value,
        label: dto.label ?? null,
        is_primary: dto.is_primary ?? false,
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          `Contato ${dto.contact_type} com valor '${dto.value}' já existe para esta pessoa`,
        );
      }
      throw new Error(`Failed to add contact: ${error.message}`);
    }

    this.logger.log('Contact added to person', 'PersonsService', {
      personId,
      contactId: data.id,
      contactType: dto.contact_type,
    });

    return data as PersonContact;
  }

  async updateContact(
    personId: string,
    contactId: string,
    dto: UpdatePersonContactDto,
    userId?: string,
  ): Promise<PersonContact> {
    const { data: existing } = await this.supabase
      .from('person_contacts')
      .select('*')
      .eq('id', contactId)
      .eq('person_id', personId)
      .is('deleted_at', null)
      .single();

    if (!existing) {
      throw new NotFoundException(
        `Contato com id '${contactId}' não encontrado`,
      );
    }

    // Validações
    const contactType = dto.contact_type ?? existing.contact_type;
    const value = dto.value ?? existing.value;

    if (contactType === 'email' && dto.value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(dto.value)) {
        throw new BadRequestException('Email inválido');
      }
    }

    if ((contactType === 'phone' || contactType === 'whatsapp') && dto.value) {
      const cleanedPhone = dto.value.replace(/\D/g, '');
      if (cleanedPhone.length < 10 || cleanedPhone.length > 15) {
        throw new BadRequestException('Telefone inválido');
      }
      dto.value = cleanedPhone;
    }

    // Se is_primary = true, remover primary de outros do mesmo tipo
    if (dto.is_primary) {
      await this.supabase
        .from('person_contacts')
        .update({ is_primary: false })
        .eq('person_id', personId)
        .eq('contact_type', contactType)
        .neq('id', contactId)
        .is('deleted_at', null);
    }

    const { data, error } = await this.supabase
      .from('person_contacts')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', contactId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update contact: ${error.message}`);
    }

    this.logger.log('Contact updated', 'PersonsService', {
      personId,
      contactId,
    });

    return data as PersonContact;
  }

  async removeContact(
    personId: string,
    contactId: string,
    userId: string,
  ): Promise<void> {
    const { data: existing } = await this.supabase
      .from('person_contacts')
      .select('*')
      .eq('id', contactId)
      .eq('person_id', personId)
      .is('deleted_at', null)
      .single();

    if (!existing) {
      throw new NotFoundException(
        `Contato com id '${contactId}' não encontrado`,
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'person_contacts',
      contactId,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete contact: ${result.error}`);
    }

    this.logger.log('Contact removed from person', 'PersonsService', {
      personId,
      contactId,
    });
  }
}
