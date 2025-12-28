# Changelog - Migrações do Banco de Dados

Todas as mudanças notáveis no esquema do banco de dados serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [2025-12-28] - Sincronização de Perfil com Supabase Auth e Melhorias no Redirecionamento

### Changed - Backend
- **UsersService.completeProfile()**: Sincronização com Supabase Auth
  - Atualiza `user_metadata` no Supabase Auth ao completar perfil
  - Atualiza Display name no Supabase Dashboard (Authentication > Users)
  - Preserva metadados existentes ao atualizar `user_metadata`
  - Atualiza `full_name`, `given_name`, `family_name` e `avatar_url` no Supabase Auth
  - Logs detalhados para debugging
- **UsersController.completeProfile()**: Resposta expandida
  - Retorna `tenant_id` na resposta para redirecionamento correto
  - Retorna `email_verified` na resposta
  - Melhora sincronização entre banco de dados e Supabase Auth

### Changed - Frontend
- **CompleteProfile.tsx**: Melhorias no fluxo de completar perfil
  - Recarrega sessão do Supabase após completar perfil (`refreshSession()`)
  - Atualiza `user_metadata` no frontend após completar perfil
  - Redirecionamento inteligente baseado em `tenant_id`:
    - **Sem `tenant_id`**: Redireciona para `/aguardando-aprovacao`
    - **Com `tenant_id`**: Redireciona para `/selecionar-escola`
  - Melhora feedback visual e logs durante o processo
  - Aguarda 500ms antes de redirecionar para garantir sincronização

### Fixed
- ✅ **Display name no Supabase Dashboard**: Agora é atualizado corretamente ao completar perfil
- ✅ **Redirecionamento após completar perfil**: Baseado corretamente no `tenant_id`
- ✅ **Sincronização de metadados**: Frontend e backend sincronizados com Supabase Auth

### Technical Details
- Usa `supabase.auth.admin.updateUserById()` para atualizar metadados no Supabase Auth
- Preserva metadados existentes ao fazer merge com novos dados
- Busca metadados atuais antes de atualizar para evitar sobrescrever dados importantes
- Tratamento de erros robusto: não bloqueia o fluxo se atualização do Auth falhar

---

## [2025-12-28] - Fluxo Completo de Registro com Verificação e Aprovação

### Added - Database Schema
- **Migration `20251228044432_add_email_verified_to_users.sql`**: Coluna email_verified
  - Campo `email_verified BOOLEAN DEFAULT false`
  - Índice `idx_users_email_verified` para performance
  - Usuários Google OAuth marcados como verificados automaticamente
  - Comentário: "Usuários com email não verificado não podem acessar o sistema"

### Added - Backend
- **CompleteProfileDto**: DTO para completar perfil
  - Campos: `given_name`, `family_name`, `avatar_url` (opcional)
  - Validações: min 2 chars, max 50 chars, URL válida para avatar
- **UsersService.completeProfile()**: Método para completar perfil
  - Atualiza `full_name` e `avatar_url`
  - Invalida cache do usuário
  - Log de atividade: `profile_completed`
- **UsersService.isOwner()**: Método otimizado para verificar ownership
  - Consulta direta em `tenant_owners`
  - Retorna boolean
  - Usado na lógica de redirecionamento
- **UsersController POST /users/complete-profile**: Endpoint para completar perfil
  - Protegido com `JwtAuthGuard`
  - Valida dados com `CompleteProfileDto`
  - Retorna usuário atualizado

### Changed - Backend
- **UsersService.syncUserFromAuth0()**: Verificação de email obrigatória
  - **BLOQUEIA** login se `email_verified = false`
  - Lança exceção: "Email não verificado. Verifique seu email antes de continuar."
  - Salva `email_verified` do Auth0 no banco
  - Atualiza campo em usuários existentes
- **UserStatusDto**: Expandido com novos campos
  - `emailVerified`: Se email foi verificado
  - `hasCompletedProfile`: Se tem nome e sobrenome
  - Novos status: `email_unverified`, `incomplete_profile`
- **UsersService.getUserStatus()**: Lógica expandida
  - Verifica email_verified
  - Verifica perfil completo (nome/sobrenome)
  - Usa método `isOwner()` otimizado
  - Retorna status com prioridades corretas

### Added - Frontend
- **EmailVerification.tsx**: Página de verificação de email
  - Exibe mensagem para verificar email
  - Botão "Já Verifiquei - Continuar" (faz logout/login)
  - Botão "Reenviar Email" (instrui fazer logout/login)
  - Botão "Sair" (logout completo)
  - Design moderno com ícones e gradientes
- **CompleteProfile.tsx**: Página para completar cadastro
  - Formulário: Nome, Sobrenome, Avatar (opcional)
  - Preview do avatar em tempo real
  - Validações client-side
  - Loading states e error handling
  - Redireciona para SelectSchool após completar
- **App.tsx**: Novas rotas adicionadas
  - `/verificar-email` → EmailVerification
  - `/completar-cadastro` → CompleteProfile
  - Ambas protegidas com `ProtectedRoute`

### Changed - Frontend
- **SelectSchool.tsx**: Lógica de redirecionamento com prioridades
  1. **Email não verificado** → `/verificar-email`
  2. **Perfil incompleto** → `/completar-cadastro`
  3. **Sem tenant** → `/aguardando-aprovacao`
  4. **Não é owner + sem escolas** → `/aguardando-aprovacao`
  5. **Owner ou tem escolas** → Continua normalmente
- **AuthSync.tsx**: Sincronização automática mantida
  - Chama `/api/auth/sync` após login
  - Trata erros de email não verificado

### User Flows

#### Fluxo 1: Registro Email (Novo Usuário)
```
1. Usuário clica "Registrar com Email"
2. Auth0 Universal Login (signup)
3. Preenche: Email + Senha
4. Auth0 envia email de verificação
5. Usuário clica no link do email
6. Email verificado no Auth0
7. Faz login
8. AuthSync sincroniza (email_verified = true)
9. Redireciona para /completar-cadastro
10. Preenche: Nome + Sobrenome + Avatar
11. Sistema verifica se é owner:
    - Se SIM: /selecionar-escola
    - Se NÃO: /aguardando-aprovacao
```

#### Fluxo 2: Registro Email (Sem Verificar)
```
1. Usuário cria conta
2. NÃO verifica email
3. Tenta fazer login
4. AuthSync tenta sincronizar
5. Backend bloqueia: "Email não verificado"
6. Redireciona para /verificar-email
7. Usuário verifica email
8. Faz logout/login novamente
9. Continua fluxo normal
```

#### Fluxo 3: Registro Google (Completo)
```
1. Usuário clica "Registrar com Google"
2. Auth0 OAuth Google
3. Google já fornece: nome, email verificado
4. AuthSync sincroniza (email_verified = true)
5. Perfil já completo (tem nome/sobrenome)
6. Sistema verifica ownership:
    - Se owner: /selecionar-escola
    - Se não: /aguardando-aprovacao
```

#### Fluxo 4: Registro Google (Incompleto)
```
1. Login com Google
2. Google NÃO fornece nome completo
3. AuthSync sincroniza
4. Redireciona para /completar-cadastro
5. Preenche nome/sobrenome
6. Verifica ownership e redireciona
```

### Security
- ✅ **Email verification obrigatório**: Bloqueio no backend
- ✅ **Validação de perfil**: Nome e sobrenome obrigatórios
- ✅ **Endpoint protegido**: `JwtAuthGuard` em complete-profile
- ✅ **Validações robustas**: `class-validator` no DTO
- ✅ **Cache invalidado**: Após completar perfil
- ✅ **Logs de auditoria**: Todas as ações registradas

### Breaking Changes
- ⚠️ **Login bloqueado sem email verificado**: Usuários devem verificar email
- ⚠️ **Perfil obrigatório**: Nome e sobrenome necessários para acessar sistema
- ⚠️ **Nova coluna**: `email_verified` adicionada à tabela `users`

### Migration Notes
- ✅ Usuários Google OAuth marcados como verificados automaticamente
- ✅ Usuários existentes não afetados (podem completar perfil depois)
- ✅ Novos usuários seguem fluxo completo obrigatório

---

## [2025-12-28] - Autenticação Simplificada via Auth0 Universal Login

### Changed - Estratégia de Autenticação
- **REMOVIDO**: Sistema de registro manual (backend próprio)
- **ADOTADO**: Auth0 Universal Login para TODA autenticação
  - Google OAuth (mantido)
  - Email/Senha via Auth0 Database connection
  - Formulários gerenciados pelo Auth0 (signup/login)
  - Backend apenas sincroniza usuários após autenticação

### Removed - Backend
- ❌ **RegisterDto**: DTO de registro manual removido
- ❌ **AuthService.registerUser()**: Método de registro manual removido
- ❌ **AuthService.createAuth0User()**: Método de criação no Auth0 removido
- ❌ **AuthController POST /api/auth/register**: Endpoint de registro removido
- ✅ **AuthService simplificado**: Mantido apenas `syncUser()`

### Removed - Frontend
- ❌ **Register.tsx**: Página de registro manual removida
- ❌ **Formulários de registro**: Removidos da aplicação
- ❌ **Validações de senha**: Movidas para Auth0

### Changed - Frontend
- **Login.tsx**: Refatorado com sistema de abas
  - **Aba "Entrar"**:
    - Botão "Entrar com Google" (OAuth)
    - Botão "Entrar com Email" (Auth0 Database)
  - **Aba "Criar Conta"**:
    - Botão "Registrar com Google" (OAuth)
    - Botão "Registrar com Email" (Auth0 Database)
  - Ambas as abas redirecionam para Auth0 Universal Login
  - `screen_hint: 'signup'` para tela de registro
  - `screen_hint: 'login'` para tela de login

### Architecture Changes
- ✅ **Auth0 como única fonte de verdade**: Toda autenticação via Auth0
- ✅ **Backend simplificado**: Apenas sincroniza usuários autenticados
- ✅ **Menos código**: Removido ~200 linhas de código de registro
- ✅ **Mais seguro**: Auth0 gerencia senhas, validações, recuperação
- ✅ **Melhor UX**: Formulários profissionais do Auth0

### User Flows

#### Fluxo 1: Login com Google (OAuth)
```
1. Usuário clica "Entrar com Google" (aba Entrar)
2. Redireciona para Auth0 Universal Login
3. Auth0 autentica via Google OAuth
4. Redireciona de volta para app
5. Backend sincroniza usuário (cria se não existe)
6. Redireciona para /selecionar-escola
```

#### Fluxo 2: Login com Email/Senha
```
1. Usuário clica "Entrar com Email" (aba Entrar)
2. Redireciona para Auth0 Universal Login (tela de login)
3. Usuário digita email/senha no formulário Auth0
4. Auth0 valida credenciais
5. Redireciona de volta para app
6. Backend sincroniza usuário
7. Redireciona para /selecionar-escola
```

#### Fluxo 3: Registro com Email/Senha
```
1. Usuário clica "Registrar com Email" (aba Criar Conta)
2. Redireciona para Auth0 Universal Login (tela de signup)
3. Usuário preenche formulário no Auth0
4. Auth0 valida e cria conta
5. Redireciona de volta para app
6. Backend sincroniza novo usuário
7. Redireciona para /selecionar-escola
```

### Security
- ✅ **Senhas gerenciadas pelo Auth0**: Bcrypt, salt, hash automático
- ✅ **Validações robustas**: Auth0 valida força de senha
- ✅ **Recuperação de senha**: Fluxo nativo do Auth0
- ✅ **MFA disponível**: Pode ser ativado no Auth0
- ✅ **Logs de auditoria**: Auth0 Dashboard

### Benefits
- 🚀 **Menos código para manter**: ~200 linhas removidas
- 🔒 **Mais seguro**: Auth0 é especialista em autenticação
- 🎨 **UI profissional**: Formulários do Auth0 customizáveis
- 📧 **Emails transacionais**: Verificação, recuperação via Auth0
- 🌍 **Internacionalização**: Auth0 suporta múltiplos idiomas
- 📊 **Analytics**: Dashboard Auth0 com métricas de login

### Migration Notes
- ✅ **Migration `20251228010230_make_auth0_id_optional.sql`**: MANTIDA
  - auth0_id continua opcional (usuários legados)
  - Email continua sendo chave principal
  - Novos usuários sempre terão auth0_id (via Auth0)
- ✅ **Usuários existentes**: Não afetados
- ✅ **Backend sync**: Funciona igual para Google e Email/Senha

### Breaking Changes
- ⚠️ **Endpoint removido**: `POST /api/auth/register` não existe mais
- ⚠️ **Frontend**: Rota `/register` redireciona para `/login`
- ⚠️ **Dependências**: `axios` pode ser removido do backend (se não usado)

---

## [2025-12-28] - Tela de Aguardando Aprovação e Correção de Sync Auth0

### Fixed - Backend
- **UsersService.syncUserFromAuth0()**: Corrigido erro de duplicação de email
  - Agora busca usuário por `auth0_id OR email` (antes era apenas `auth0_id`)
  - Detecta e atualiza `auth0_id` quando usuário troca de provider (ex: email → Google)
  - Corrige erro: "duplicate key value violates unique constraint users_email_key"
  - Logs detalhados: "Updating auth0_id for existing user (provider changed)"
  - Detecta múltiplos usuários com mesmo email e loga warning

### Added - Backend
- **UserStatusDto**: Novo DTO para status do usuário
  - Campos: `hasTenant`, `hasSchools`, `hasRoles`, `isOwner`, `status`, `message`
  - Status: 'active', 'pending', 'blocked'
- **UsersService.getUserStatus()**: Novo método para verificar status completo
  - Verifica se usuário tem tenant_id
  - Verifica se tem escolas disponíveis
  - Verifica se tem roles atribuídos
  - Verifica se é owner da instituição
  - Retorna status consolidado
- **UsersController**: Novo endpoint `GET /api/users/status`
  - Protegido com `JwtAuthGuard`
  - Retorna `UserStatusDto`

### Added - Frontend
- **PendingApproval.tsx**: Nova página de "Aguardando Aprovação"
  - Design informativo com avatar do usuário
  - Mostra: nome, email, instituição, status
  - Alert explicativo sobre acesso pendente
  - Instruções do que fazer (contatar admin, aguardar aprovação)
  - Botão de Logout (limpa sessão completa)
  - Botão "Contatar Administrador" (abre email)
  - Estilização moderna com gradiente e cards

### Changed - Frontend
- **App.tsx**: Adicionada rota `/aguardando-aprovacao`
  - Protegida com `ProtectedRoute`
  - Renderiza componente `PendingApproval`
- **SelectSchool.tsx**: Validação de tenant_id e redirecionamento
  - Busca dados do usuário atual (`/api/users/me`)
  - Verifica se `user.tenant_id` existe
  - Se NÃO existe: redireciona para `/aguardando-aprovacao`
  - Se existe mas sem escolas: redireciona para `/aguardando-aprovacao`
  - Logs detalhados de cada redirecionamento
  - Loading state atualizado para incluir carregamento do usuário

### User Experience
- ✅ Usuários sem tenant/escolas não ficam mais "presos" na tela de seleção
- ✅ Mensagem clara sobre status pendente e próximos passos
- ✅ Facilita contato com administrador via email
- ✅ Logout completo disponível na tela de aguardando aprovação
- ✅ Design consistente com resto da aplicação

### Bug Fixes
- ✅ Corrigido erro de duplicação ao fazer login com provider diferente
- ✅ Corrigido dashboard não carregando dados para usuários sem tenant
- ✅ Corrigido usuários sem escolas ficando em loop na tela de seleção

### Logs e Auditoria
Novos eventos logados:
- ✅ Atualização de `auth0_id` quando provider muda
- ✅ Detecção de múltiplos usuários com mesmo email
- ✅ Redirecionamentos para tela de aguardando aprovação
- ✅ Usuários sem tenant_id tentando acessar sistema

---

## [2025-12-28] - Isolamento Completo de Instituições (Tenant Isolation)

### Added - Backend
- **TenantAccessGuard**: Guard global que valida acesso do usuário ao tenant em TODAS as requisições
  - Registrado como `APP_GUARD` global
  - Verifica se `user.tenant_id` corresponde ao `x-tenant-id` solicitado
  - Bloqueia acesso a tenants diferentes com `403 Forbidden`
  - Logs detalhados de todas as tentativas de acesso indevido
  - Permite primeiro acesso (usuários sem tenant_id)

### Changed - Backend
- **UsersService.syncUserFromAuth0()**: Validação crítica de tenant
  - Vincula usuário ao tenant no primeiro login
  - **BLOQUEIA** tentativas de acesso a outros tenants após vinculação
  - Logs de segurança para auditoria
  - Erro: "Acesso negado: este usuário pertence a outra instituição"

### Changed - Frontend
- **Layout.handleLogout()**: Logout COMPLETO
  - Limpa `localStorage.clear()`
  - Limpa `sessionStorage.clear()`
  - Limpa cookies Auth0
  - Limpa React Query cache
  - Reseta PostHog
  - Força reload completo da página (`window.location.replace`)

### Security
- ✅ **Um usuário = Uma instituição**: Vinculação permanente
- ✅ **Validação em todas as requisições**: TenantAccessGuard global
- ✅ **Logs de auditoria**: Todas as tentativas de acesso indevido
- ✅ **Logout completo**: Limpa TODA a sessão
- ✅ **Isolamento garantido**: Impossível acessar múltiplos tenants

### Documentation
- **TENANT_ISOLATION.md**: Documentação completa do sistema
  - Princípios de isolamento
  - Fluxos de validação
  - Diagramas de sequência
  - Troubleshooting
  - Scripts de teste

### Breaking Changes
- ⚠️ Usuários existentes que tentarem acessar múltiplos tenants serão bloqueados
- ⚠️ Necessário limpar sessão completamente ao trocar de tenant (logout obrigatório)

---

## [2025-12-28] - API de Gerenciamento de Proprietários (Owners)

### Added - Backend
- **OwnersModule**: Novo módulo completo para gerenciamento de proprietários
  - `OwnersService`: Lógica de negócio para owners
  - `OwnersController`: Endpoints REST protegidos por ServiceKey
  - `AddOwnerDto` e `UpdateOwnerDto`: DTOs com validações
  
### Added - Endpoints
- `POST /api/tenants/:tenantId/owners`: Adicionar proprietário
- `GET /api/tenants/:tenantId/owners`: Listar proprietários
- `DELETE /api/tenants/:tenantId/owners/:userId`: Remover proprietário
- `PATCH /api/tenants/:tenantId/owners/:userId`: Atualizar nível de propriedade

### Changed - Backend
- **CreateTenantDto**: Adicionados campos opcionais `owner_email`, `owner_auth0_id`, `ownership_level`
- **TenantsService.createTenant()**: Agora adiciona owner automaticamente se fornecido
- **UsersService**: Novo método `findOrCreateByEmail()` para buscar ou criar usuário por email

### Features
- ✅ Criar tenant COM owner em uma única requisição
- ✅ Adicionar owners separadamente após criação do tenant
- ✅ Suporte a múltiplos proprietários (owner e co-owner)
- ✅ Proteção contra remoção do último proprietário
- ✅ Criação automática de usuários por email (auth0_id preenchido no primeiro login)
- ✅ Atribuição automática de role `owner` em `user_roles`
- ✅ Validações completas (email, duplicatas, último owner)

### Documentation
- **API_OWNERS.md**: Documentação completa da API
  - Todos os endpoints com exemplos
  - Fluxos de uso completos
  - Códigos de erro
  - Scripts de teste
  - Troubleshooting

### Testing
- **test-owners-api.sh**: Script bash para teste automatizado
  - Criar tenant com owner
  - Adicionar co-owner
  - Listar owners
  - Atualizar nível
  - Validar proteções

### Security
- ✅ Todos os endpoints protegidos por `ServiceKeyGuard`
- ✅ Validação de email format
- ✅ Validação de ownership_level enum
- ✅ Logs detalhados de todas as operações

---

## [2025-12-28] - Correção de Usuários Duplicados (Google OAuth vs Auth0)

### Fixed - Database
- **Usuários duplicados**: Identificado e corrigido problema de usuários duplicados
  - Usuário criava conta via Auth0 Database (email/senha)
  - Depois fazia login via Google OAuth (criava novo usuário)
  - Resultado: 2 usuários, ownership no usuário errado
  
### Changed - Database
- **Ownership transferido**: De Auth0 Database → Google OAuth
- **Roles transferidos**: De Auth0 Database → Google OAuth
- **Usuário Auth0 deletado**: Mantido apenas Google OAuth

### Root Cause
- Backend cria novo usuário automaticamente no primeiro login
- Não havia validação de email duplicado entre providers
- Google OAuth ID ≠ Auth0 Database ID

### Solution Applied
- Script `check-duplicate.js` criado para detectar duplicatas
- Ownership e roles transferidos para usuário Google OAuth
- Usuário Auth0 Database removido
- Agora `bruno6821@gmail.com` tem acesso completo como PROPRIETÁRIO

### Prevention
- TODO: Adicionar validação de email único na tabela `users`
- TODO: Criar trigger para prevenir duplicatas por email
- TODO: Implementar merge automático de contas no backend

---

## [2025-12-28] - Conversão Automática Subdomain → UUID

### Added - Backend
- **TenantIdInterceptor**: Interceptor global que converte subdomain para UUID
  - Frontend pode enviar subdomain ("ensinosbruno") ou UUID
  - Backend sempre recebe UUID internamente
  - Conversão automática e transparente
  - Validação de tenant existente

### Changed - Backend
- **x-tenant-id header**: Agora aceita tanto subdomain quanto UUID
- **Todos os controllers**: Continuam usando `@Headers('x-tenant-id')`
- **Fluxo simplificado**: Frontend não precisa buscar UUID

### Technical Details
- Interceptor registrado globalmente em `AppModule`
- Executa ANTES do `LoggingInterceptor`
- Modifica o header antes de chegar nos controllers
- Throw `BadRequestException` se tenant não existe

---

## [2025-12-28] - Correção Auth0 ID vs UUID

### Fixed - Backend
- **PermissionsService**: Agora converte Auth0 ID para UUID antes de consultar banco
  - Método helper `getUserUuidFromAuth0()` criado
  - Todos os métodos públicos agora aceitam Auth0 ID
  - Métodos privados continuam usando UUID internamente
- **RolesService**: Corrigido `getUserRoles()` para buscar UUID do usuário
  - Busca usuário por `auth0_id` primeiro
  - Retorna array vazio se usuário não existe (primeira vez)
  - Logs detalhados com auth0_id e userId

### Changed - Backend
- **user_id**: Todos os services agora trabalham com Auth0 ID externamente
- **Compatibilidade**: UUID usado apenas internamente nas queries
- **Logging**: Logs incluem tanto auth0_id quanto userId para debug

---

## [2025-12-28] - Correção de Rotas Duplicadas (/api/api/)

### Fixed - Backend
- **Rotas duplicadas**: Removido prefixo `api/` dos controllers
  - `@Controller('api/permissions')` → `@Controller('permissions')`
  - `@Controller('api/roles')` → `@Controller('roles')`
  - `@Controller('api/invitations')` → `@Controller('invitations')`
- **Causa**: `main.ts` já adiciona prefixo global `/api`
- **Resultado**: Rotas agora funcionam corretamente:
  - ✅ `/api/permissions/user` (antes: `/api/api/permissions/user`)
  - ✅ `/api/roles/user/:userId` (antes: `/api/api/roles/user/:userId`)
  - ✅ `/api/invitations` (antes: `/api/api/invitations`)

---

## [2025-12-28] - Sistema de Logging Otimizado

### Added - Logging
- **AllExceptionsFilter**: Captura TODOS os erros não tratados
- **Documentação**: `Backend-SmartGesti-Ensino/LOGGING.md` - Guia completo

### Fixed - Logging
- **error.log vazio**: Agora captura todos os erros via ExceptionFilter
- **Logs duplicados**: Apenas requisições lentas (>1s) ou erros são logados
- **Spam de logs**: Requisições normais não são mais logadas (exceto em DEBUG)

### Changed - LoggingInterceptor
- ✅ Apenas loga requisições lentas (> 1s)
- ✅ Sempre loga erros (4xx, 5xx)
- ✅ Não loga `/health` e `/favicon.ico`
- ✅ Modo DEBUG loga tudo (para desenvolvimento)

### Changed - Error Handling
- ✅ ExceptionFilter global captura tudo
- ✅ Stack traces completos no error.log
- ✅ Metadata rica (body, query, params, ip, userAgent)
- ✅ Respostas HTTP formatadas

---

## [2025-12-28] - Correção de Rotas e Múltiplos Toasts

### Fixed - Backend
- **Ordem de Rotas**: Movido `@Get('user/:userId')` para ANTES de `@Get(':id')` no RolesController
- **404 em /api/roles/user/:userId**: Resolvido com reordenação de rotas

### Fixed - Frontend
- **Múltiplos Toasts**: Implementado flag `isHandlingError` no axios interceptor
- **Toast Duplicado**: Header `X-Skip-Interceptor` para pular interceptor em hooks específicos
- **Erro 404 Silencioso**: Roles não encontrados não mostram mais toast (esperado em primeira execução)

### Changed - Error Handling
- ✅ Apenas 1 toast por erro
- ✅ Interceptor pode ser pulado com header
- ✅ Erros esperados são silenciosos
- ✅ Console logs estruturados mantidos

---

## [2025-12-28] - Seed Padronizada + Bruno como Proprietário

### Added - Seeds via CLI
- **Seed Padronizada**: `20251228025258_seed_bruno_owner.sql`
- **Documentação**: `supabase/SEEDS.md` - Guia completo de seeds via CLI
- **Bruno como Proprietário**: Adicionado via seed (não manual)

### Changed - Padrão de Interação com Banco
- ✅ **TODAS** as interações com banco via Supabase CLI
- ✅ Seeds versionadas e replicáveis
- ✅ Feedback com RAISE NOTICE
- ❌ Nunca mais SQL direto no Dashboard

### Seed Executada
```sql
-- Criou:
- Usuário: bruno6821@gmail.com (UUID: 9b57cde7-bbf3-400f-a19d-c230e460ef65)
- Tenant: ensinosbruno (UUID: 4385d3f5-1238-4943-a79e-0ad92d4a1b5d)
- Role: owner (UUID: d820b410-6c4f-4b78-bd4b-91b46c0c4446)
- Ownership: Bruno é proprietário de ensinosbruno
```

### Resultado
- ✅ Bruno tem todas as permissões em ensinosbruno
- ✅ Seed pode ser replicada em outros ambientes
- ✅ Versionada no git
- ✅ Aplicada via `npm run db:push`

---

## [2025-12-28] - Refatoração Escalável: Hooks, Services e Performance

### Added - Arquitetura Escalável
- **Hooks Customizados**:
  - `useApi`: Hook genérico para chamadas de API com retry e cache
  - `usePermissionsApi`: Hook especializado para permissões (evita re-fetches)
  - `useRoles`: Hook para gerenciar roles com React Query
  - `useInvitations`: Hook para gerenciar convites com mutations
  - `usePermissionCheck`: Hook simplificado para verificar permissão específica

- **Services** (Separação de Responsabilidades):
  - `PermissionsService`: Métodos estáticos para API de permissões
  - `RolesService`: CRUD completo de roles
  - `InvitationsService`: Gerenciamento de convites

- **Utilitários**:
  - `permissions.utils.ts`: Funções puras para verificação de permissões
  - `queryClient.ts`: Configuração otimizada do React Query

### Changed - Performance
- **PermissionsContext Refatorado**:
  - Usa `usePermissionsApi` hook otimizado
  - Funções `can` e `hasRole` memoizadas com `useCallback`
  - Context value memoizado com `useMemo`
  - Dependências corretas (user?.sub ao invés de user)
  - Flag `hasFetched` para evitar múltiplos fetches

- **React Query Configurado**:
  - `staleTime`: 5 minutos (dados frescos)
  - `gcTime`: 10 minutos (cache)
  - `refetchOnWindowFocus`: false
  - `retry`: 1 tentativa
  - Configurações específicas por tipo de dado (static, dynamic, realtime)

### Fixed - Backend
- **JWT Strategy**: Corrigido `req.user.id` para `req.user.sub` no PermissionsController
- **404 no /api/permissions/user**: Resolvido com correção do user ID

### Fixed - Re-renders
- **Problema**: PermissionsContext renderizava 4-5 vezes
- **Causa**: useEffect com dependências que mudavam referência
- **Solução**: 
  - Hook usePermissionsApi com refs para controle de fetch
  - Memoização de funções e valores
  - Cache inteligente

### Performance Improvements
- ✅ Menos re-renders (de 4-5x para 1x)
- ✅ Cache de requisições (5-10 min)
- ✅ Retry logic inteligente
- ✅ Separação de responsabilidades
- ✅ Código reutilizável e testável

### Developer Experience
- 📁 Estrutura organizada (hooks/, services/, lib/)
- 🎣 Hooks reutilizáveis
- 🔧 Utilitários tipados
- 📝 Comentários e exemplos
- 🚀 Build otimizado

---

## [2025-12-27] - Sistema de Tratamento de Erros Robusto

### Added
- Sistema completo de tratamento de erros com Sonner
- ErrorBoundary para capturar erros React
- ErrorLogger com métodos específicos por tipo de erro
- Axios interceptors para erros de API
- Toasts informativos e acionáveis
- Console logs estruturados para debug
- Tratamento específico para: API, Auth, Permissão, Validação, Rede

### Frontend Components
- ErrorBoundary: Captura erros React e exibe fallback
- ErrorLogger: Serviço centralizado de logging
- Axios Interceptors: Tratamento automático de erros HTTP
- Sonner Toasts: Feedback visual moderno

### Fixed
- PermissionsProvider agora envolve toda a aplicação
- Erros de API não quebram mais a aplicação
- Tela branca substituída por fallback informativo
- class-validator e class-transformer instalados no backend
- AuthGuard corrigido para JwtAuthGuard em todos os controllers
- Supabase client acessado via getClient() nos services

---

## [2025-12-27] - Sistema RBAC Completo + Integração Supabase CLI

### Added
- ✨ **Sistema RBAC Completo** com permissões granulares
- 🔐 **7 novas tabelas** para controle de acesso
- 👥 **9 cargos padrão** com hierarquia (0-8)
- 📧 **Sistema de convites** por email
- 🎯 **Múltiplos proprietários** por instituição
- 🚀 **Integração total com Supabase CLI**
- 📦 **Comandos NPM** simplificados para migrações
- 🤖 **Regras AI-First** para campos de contexto IA

### Migrations Applied

#### RBAC - Tenant Owners
- `20251227000030_tenant_owners_initial.sql`
  - Tabela para múltiplos proprietários por tenant
  - Campos: tenant_id, user_id, ownership_level, granted_by
  - Índices e constraints de unicidade

#### RBAC - Roles (Cargos)
- `20251227000040_roles_initial.sql`
  - Tabela de cargos com hierarquia
  - Campos: name, slug, hierarchy_level, default_permissions, is_system_role
  - Suporte a cargos customizados por tenant
  
- `20251227000050_roles_seed_system_roles.sql`
  - 9 cargos padrão inseridos:
    - Proprietário (0), Administrador (1), Diretor (2)
    - Coordenador (3), Professor (4), Secretaria (5)
    - Financeiro (6), Aluno (7), Responsável (8)

#### RBAC - Permission Groups
- `20251227000100_permission_groups_initial.sql`
  - Grupos de permissões reutilizáveis
  - Campos: tenant_id, name, slug, permissions (JSONB)

#### RBAC - User Roles
- `20251227000110_user_roles_initial.sql`
  - Atribuição de cargos aos usuários
  - Escopo: tenant_id e school_id (opcional)
  - Campos: user_id, role_id, assigned_by

#### RBAC - User Permissions
- `20251227000120_user_permissions_initial.sql`
  - Permissões específicas por usuário
  - Campos: user_id, resource, action, granted
  - Suporte a permissões negativas (revogação)

#### RBAC - User Permission Groups
- `20251227000130_user_permission_groups_initial.sql`
  - Atribuição de grupos aos usuários
  - Campos: user_id, group_id, assigned_by

#### RBAC - Invitations
- `20251227000140_invitations_initial.sql`
  - Sistema de convites por email
  - Campos: email, token, role_id, group_id, status, expires_at
  - Suporte a convite para cargo ou grupo

### Backend - NestJS Modules

#### Permissions Module
- `PermissionsService`: Lógica de verificação de permissões
  - `isOwner()`, `hasRole()`, `checkPermission()`
  - `getUserPermissions()`, `mergePermissions()`
- `PermissionGuard`: Guard para proteção de rotas
- `RequirePermission`, `RequireOwner`, `RequireRole`: Decorators
- `PermissionsController`: Endpoints de consulta

#### Roles Module
- `RolesService`: CRUD completo de cargos
  - `findAll()`, `create()`, `update()`, `remove()`
  - `assignRole()`, `removeRole()`, `getUserRoles()`
- `RolesController`: REST API para cargos
- DTOs: `CreateRoleDto`, `UpdateRoleDto`, `AssignRoleDto`

#### Invitations Module
- `InvitationsService`: Sistema de convites
  - `create()`, `findByToken()`, `accept()`, `cancel()`
  - Geração de token, validação, expiração
- `InvitationsController`: REST API para convites
- DTOs: `CreateInvitationDto`, `AcceptInvitationDto`

### Frontend - React Components

#### Permissions Context
- `PermissionsContext`: Context global de permissões
- `usePermissions()`: Hook com funções utilitárias
  - `can(resource, action)`: Verifica permissão
  - `hasRole(roleSlug)`: Verifica cargo
  - `isOwner()`: Verifica propriedade

#### Components
- `PermissionGate`: Renderização condicional por permissão
  - `OwnerOnly`, `RoleOnly`: Helpers
- `ManagePermissions`: Página de gerenciamento
  - Tabs: Convidar Usuário, Convites Pendentes, Cargos
  - Integração com react-query

#### Updates
- `Sidebar`: Atualizado com `PermissionGate`
  - Menu "Nova Escola" visível apenas para owners
  - Menu "Gerenciar Permissões" com permissão específica

### Commands Added

```bash
# Migrações
npm run db:new <nome>          # Criar nova migração
npm run db:push                # Aplicar ao remoto
npm run db:push:local          # Aplicar ao local
npm run db:pull                # Baixar mudanças remotas
npm run db:status              # Ver status das migrações
npm run db:diff                # Ver diferenças
npm run db:reset               # Resetar banco local

# Supabase
npm run supabase:start         # Iniciar local
npm run supabase:stop          # Parar local
npm run supabase:status        # Ver status
```

### Documentation

#### Updated
- `MIGRATION_RULES.md`: Adicionada seção sobre campos AI
  - Quando usar `ai_context` (JSONB) e `ai_summary` (TEXT)
  - Diferença entre tabelas de entidades e gerenciais
  - Exemplos práticos

#### New
- `MIGRATIONS_CLI.md`: Guia completo do Supabase CLI
  - Fluxo de trabalho
  - Comandos úteis
  - Troubleshooting

#### Removed
- ❌ Removidos MDs desnecessários (guias temporários)
- ❌ Removido script `apply-migrations.js` (obsoleto)

### Infrastructure

- 🔗 **Projeto linkado** ao Supabase CLI
- 🔄 **11 migrações sincronizadas** entre local e remoto
- 🛠️ **config.toml** atualizado para Postgres 17
- 📝 **Script de conversão** simplificado

### Changed
- Migração de sistema manual para **Supabase CLI oficial**
- Estrutura de migrações: pastas por modelo → arquivos timestamp
- Comandos: scripts Node.js → comandos NPM + Supabase CLI

### Fixed
- Corrigido `generate_slug()`: DROP antes de CREATE
- Corrigido `config.toml`: Removidas configurações obsoletas
- Corrigido permissões de sandbox para comandos CLI

---

## [2025-12-27] - Sistema de Migrações Implementado

### Added
- ✨ Sistema completo de migrações estilo Django
- 📁 Estrutura organizada por modelo/tabela
- 🚀 Scripts CLI para gerenciamento (`migrate.js`, `seed.js`, `create-migration.js`)
- 📝 Comandos npm para facilitar uso
- 📊 Tabela `schema_migrations` para controle de versão
- 📚 Documentação completa (README, QUICK_START, MIGRATION_RULES)

### Migrations Applied

#### Tenants
- `tenants/0001_add_business_and_address_fields.sql`
  - Campos empresariais: razao_social, cnpj, telefone, email, website
  - Inscrições: estadual e municipal
  - Endereço completo: rua, número, complemento, bairro, cidade, estado, CEP
  - Funções de validação: validate_cnpj_format, validate_cep_format
  - Constraints de validação para CNPJ, CEP e Estado

#### Schools
- `schools/0001_add_slug.sql`
  - Campo slug para URLs amigáveis
  - Função generate_slug para geração automática
  - Índice único em (tenant_id, slug)
  
- `schools/0002_add_complete_fields.sql`
  - Campos de negócio: cnpj, website, descricao, logo_url
  - Redes sociais: facebook, instagram, twitter, youtube, whatsapp
  - Endereço completo: rua, número, complemento, bairro, cidade, estado, CEP
  - Índices e constraints de validação

### Commands Added

```bash
npm run db:migrate              # Aplicar migrações pendentes
npm run db:migrate:status       # Ver status
npm run db:migrate:model=X      # Aplicar de um modelo
npm run db:seed                 # Popular banco
npm run db:seed:reset           # Reset + seed
npm run db:migration:create     # Criar nova migração
npm run db:setup                # Setup completo
```

### Documentation

- `QUICK_START.md` - Guia rápido de uso
- `MIGRATION_RULES.md` - Regras detalhadas e boas práticas
- `README.md` - Documentação completa do sistema
- `scripts/README.md` - Detalhes dos scripts CLI
- `CHANGELOG.md` - Este arquivo

### Infrastructure

- Função RPC `exec_sql` para execução de SQL via API
- Tabela `schema_migrations` para rastreamento
- Scripts Node.js para automação
- Integração com package.json

---

## Template para Futuras Entradas

```markdown
## [YYYY-MM-DD] - Título da Release

### Added
- Nova funcionalidade X
- Nova migração Y

### Changed
- Alteração em campo Z
- Atualização de índice W

### Deprecated
- Campo X será removido na próxima versão

### Removed
- Campo Y removido
- Índice Z removido

### Fixed
- Corrigido problema com validação de CPF
- Corrigido índice duplicado

### Security
- Adicionada validação de entrada
- Corrigido SQL injection potencial

### Migrations Applied
- `modelo/XXXX_description.sql` - Descrição breve
```

---

**Formato de Data**: YYYY-MM-DD (ISO 8601)
**Versionamento**: Baseado em datas, não em números de versão
