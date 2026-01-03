#!/usr/bin/env node

const http = require('http');
const path = require('path');

const BACKEND_URL = 'http://localhost:3001';
const DOCS_PATH = path.join(__dirname, '../../docs/knowledge-base/pages');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeRequest(method, pathname, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, BACKEND_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = { status: res.statusCode, data: JSON.parse(data) };
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          } else {
            resolve(response);
          }
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function waitForServer(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`[${i + 1}/${maxRetries}] Aguardando servidor iniciar...`);
      const response = await makeRequest('GET', '/health');
      console.log('✓ Servidor pronto!');
      return true;
    } catch (error) {
      await sleep(1000);
    }
  }
  throw new Error('Timeout aguardando servidor iniciar');
}

async function ingestDocuments() {
  try {
    console.log('\n📚 Iniciando ingestão de documentos RAG...\n');

    // Aguardar servidor estar pronto
    await waitForServer();

    // Fazer request de ingestão
    console.log(`\n📂 Ingerindo documentos de: ${DOCS_PATH}\n`);
    const response = await makeRequest('POST', '/api/rag/ingest/directory', {
      path: DOCS_PATH,
    });

    // Exibir resultados
    const { data } = response;
    if (data.success) {
      console.log('\n╔════════════════════════════════════════════╗');
      console.log('║         INGESTÃO CONCLUÍDA COM SUCESSO     ║');
      console.log('╠════════════════════════════════════════════╣');
      console.log(`║ Documentos processados: ${data.documentsProcessed}`);
      console.log(`║ Documentos com sucesso: ${data.documentsSuccessful}`);
      console.log(`║ Total de chunks: ${data.totalChunks}`);
      console.log('╚════════════════════════════════════════════╝\n');

      // Mostrar detalhes
      console.log('Detalhes por documento:\n');
      data.details.forEach((detail, i) => {
        const status = detail.success ? '✓' : '✗';
        console.log(`${i + 1}. ${status} ${detail.title}`);
        console.log(`   Chunks: ${detail.chunksCreated}`);
        console.log(`   ${detail.message}\n`);
      });

      process.exit(0);
    } else {
      console.error('❌ Ingestão falhou!');
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

// Executar
ingestDocuments();
