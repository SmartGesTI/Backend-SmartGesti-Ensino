# SmartGesti Ensino - Backend

Backend NestJS para o sistema SmartGesti Ensino.

## 🚀 Tecnologias

- **NestJS** - Framework Node.js
- **TypeScript** - Tipagem estática
- **Auth0** - Autenticação JWT
- **Supabase** - Banco de dados PostgreSQL
- **Passport** - Estratégia JWT

## 📋 Pré-requisitos

- Node.js 22.x LTS
- npm ou yarn
- Conta Auth0
- Conta Supabase

## 🔧 Instalação

```bash
npm install
```

## ⚙️ Configuração

Crie um arquivo `.env` na raiz do projeto:

```env
AUTH0_DOMAIN=seu-tenant.auth0.com
AUTH0_AUDIENCE=https://smartgesti-ensino-api
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=sua-service-key
PORT=3001
```

## 🏃 Executando

### Desenvolvimento

```bash
npm run start:dev
```

### Produção

```bash
npm run build
npm run start:prod
```

## 📡 Endpoints

- `GET /health` - Health check
- `POST /api/auth/sync` - Sincronizar usuário do Auth0
- `GET /api/users/me` - Obter dados do usuário atual

## 🚢 Deploy no Railway

1. Conecte seu repositório GitHub ao Railway
2. Configure as variáveis de ambiente no dashboard
3. O Railway detectará automaticamente o `railway.json` e fará o build

O deploy será feito automaticamente a cada push na branch principal.
