#!/usr/bin/env node
/**
 * Verifica o backend na Vercel após deploy.
 * Uso: node scripts/verify-vercel.mjs [baseUrl]
 *      VERCEL_BACKEND_URL=https://... node scripts/verify-vercel.mjs
 * Exit 0 se todos os checks passarem; 1 caso contrário.
 */

const TIMEOUT_MS = 15000;
const DEFAULT_BASE_URL = 'https://backend-smart-gesti-ensino.vercel.app';

const baseUrl = process.env.VERCEL_BACKEND_URL || process.argv[2] || DEFAULT_BASE_URL;
const base = baseUrl.replace(/\/$/, '');

const checks = [];

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function checkHealth() {
  try {
    const res = await fetchWithTimeout(`${base}/health`);
    const ok = res.ok && res.status === 200;
    let body = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    const statusOk = body && body.status === 'ok';
    if (ok && statusOk) {
      checks.push({ name: 'GET /health', ok: true });
      return true;
    }
    checks.push({
      name: 'GET /health',
      ok: false,
      detail: `status=${res.status}, body.status=${body?.status ?? 'N/A'}`,
    });
    return false;
  } catch (err) {
    checks.push({
      name: 'GET /health',
      ok: false,
      detail: err.message || String(err),
    });
    return false;
  }
}

async function checkOptions() {
  try {
    const res = await fetchWithTimeout(`${base}/api/tenants/magistral`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://magistral.smartgesti.com.br' },
    });
    const statusOk = res.status === 204;
    const corsHeader = res.headers.get('Access-Control-Allow-Origin');
    const hasCors = corsHeader != null;
    if (statusOk) {
      checks.push({
        name: 'OPTIONS /api/tenants/magistral',
        ok: true,
        detail: hasCors ? `CORS: ${corsHeader}` : 'CORS header not checked',
      });
      return true;
    }
    checks.push({
      name: 'OPTIONS /api/tenants/magistral',
      ok: false,
      detail: `status=${res.status}`,
    });
    return false;
  } catch (err) {
    checks.push({
      name: 'OPTIONS /api/tenants/magistral',
      ok: false,
      detail: err.message || String(err),
    });
    return false;
  }
}

async function main() {
  console.log(`Verificando backend: ${base}\n`);
  await checkHealth();
  await checkOptions();

  let allOk = true;
  for (const c of checks) {
    const icon = c.ok ? 'OK' : 'FAIL';
    const detail = c.detail ? ` (${c.detail})` : '';
    console.log(`  [${icon}] ${c.name}${detail}`);
    if (!c.ok) allOk = false;
  }

  console.log('');
  if (allOk) {
    console.log('Todos os checks passaram.');
    process.exit(0);
  } else {
    console.log('Alguns checks falharam. Confira os logs na Vercel.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
