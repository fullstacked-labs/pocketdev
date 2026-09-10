import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createMasqueradeProxy } from '../src/proxy.js';
import { isPortOpen, detectDevPorts, findFreePort } from '../src/port.js';

test('Proxy rewrites request headers (Host, Origin, Referer, x-forwarded-proto)', async (t) => {
  const backendPort = await findFreePort();
  const proxyPort = await findFreePort();

  let capturedHeaders = null;

  // 1. Mock dev server
  const backend = http.createServer((req, res) => {
    capturedHeaders = req.headers;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });

  await new Promise((r) => backend.listen(backendPort, '127.0.0.1', r));

  // 2. PocketDev masquerade proxy
  const { server: proxyServer } = createMasqueradeProxy({
    targetPort: backendPort,
    getPublicUrl: () => 'https://mock.trycloudflare.com'
  });

  await new Promise((r) => proxyServer.listen(proxyPort, '127.0.0.1', r));

  t.after(() => {
    backend.close();
    proxyServer.close();
  });

  // 3. Client sends request mimicking external Cloudflare tunnel
  await fetch(`http://127.0.0.1:${proxyPort}/api/test`, {
    headers: {
      Host: 'mock.trycloudflare.com',
      Origin: 'https://mock.trycloudflare.com',
      Referer: 'https://mock.trycloudflare.com/settings'
    }
  });

  assert.ok(capturedHeaders, 'Backend should have received request');
  assert.strictEqual(capturedHeaders.host, `localhost:${backendPort}`, 'Host must be masqueraded to localhost:<port>');
  assert.strictEqual(capturedHeaders.origin, `http://localhost:${backendPort}`, 'Origin must be masqueraded to http://localhost:<port>');
  assert.strictEqual(capturedHeaders.referer, `http://localhost:${backendPort}/`, 'Referer must be masqueraded to http://localhost:<port>/');
  assert.strictEqual(capturedHeaders['x-forwarded-proto'], 'https', 'x-forwarded-proto must be https');
  assert.strictEqual(capturedHeaders['x-forwarded-ssl'], 'on', 'x-forwarded-ssl must be on');
});

test('Proxy rewrites response Location header in 302 redirects to public tunnel URL', async (t) => {
  const backendPort = await findFreePort();
  const proxyPort = await findFreePort();
  const publicTunnelUrl = 'https://cool-tunnel-name.trycloudflare.com';

  // 1. Mock backend returning a redirect to localhost:<port>
  const backend = http.createServer((req, res) => {
    res.writeHead(302, {
      Location: `http://localhost:${backendPort}/auth/callback?code=123`
    });
    res.end();
  });

  await new Promise((r) => backend.listen(backendPort, '127.0.0.1', r));

  // 2. PocketDev masquerade proxy
  const { server: proxyServer } = createMasqueradeProxy({
    targetPort: backendPort,
    getPublicUrl: () => publicTunnelUrl
  });

  await new Promise((r) => proxyServer.listen(proxyPort, '127.0.0.1', r));

  t.after(() => {
    backend.close();
    proxyServer.close();
  });

  // 3. Client sends request through proxy (redirect manual to inspect header)
  const res = await fetch(`http://127.0.0.1:${proxyPort}/login`, {
    redirect: 'manual'
  });

  assert.strictEqual(res.status, 302);
  const location = res.headers.get('location');
  assert.strictEqual(
    location,
    `${publicTunnelUrl}/auth/callback?code=123`,
    'Location header must be rewritten to point to public tunnel URL'
  );
});

test('Proxy strips Domain=localhost from response Set-Cookie headers', async (t) => {
  const backendPort = await findFreePort();
  const proxyPort = await findFreePort();

  // 1. Mock backend setting cookies with Domain=localhost
  const backend = http.createServer((req, res) => {
    res.setHeader('Set-Cookie', [
      `session_token=secret123; Domain=localhost; Path=/; HttpOnly; SameSite=Lax`,
      `user_pref=dark; domain=127.0.0.1; Path=/`
    ]);
    res.writeHead(200);
    res.end('ok');
  });

  await new Promise((r) => backend.listen(backendPort, '127.0.0.1', r));

  // 2. PocketDev masquerade proxy
  const { server: proxyServer } = createMasqueradeProxy({
    targetPort: backendPort,
    getPublicUrl: () => 'https://mock.trycloudflare.com'
  });

  await new Promise((r) => proxyServer.listen(proxyPort, '127.0.0.1', r));

  t.after(() => {
    backend.close();
    proxyServer.close();
  });

  // 3. Client request
  const res = await fetch(`http://127.0.0.1:${proxyPort}/test`);
  const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];

  assert.ok(rawCookies.length >= 2, 'Should receive two cookies');
  assert.ok(!rawCookies[0].includes('Domain=localhost'), 'Domain=localhost must be stripped from cookie 1');
  assert.ok(!rawCookies[1].includes('domain=127.0.0.1'), 'domain=127.0.0.1 must be stripped from cookie 2');
  assert.ok(rawCookies[0].includes('Path=/'), 'Path attribute must remain intact');
});

test('Port probing and auto-detection identifies open dev server ports', async (t) => {
  const testPort = await findFreePort();
  const unusedPort = await findFreePort();

  // 1. Verify before listening
  const beforeListen = await isPortOpen(testPort);
  assert.strictEqual(beforeListen, false, 'Port should be closed before server start');

  // 2. Start server
  const server = http.createServer((req, res) => res.end('ok'));
  await new Promise((r) => server.listen(testPort, '127.0.0.1', r));

  t.after(() => server.close());

  // 3. Verify open
  const afterListen = await isPortOpen(testPort);
  assert.strictEqual(afterListen, true, 'Port should be detected as open');

  // 4. Test detectDevPorts
  const detected = await detectDevPorts([testPort, unusedPort]);
  assert.deepStrictEqual(detected, [testPort], 'Should only detect active listening port');
});
