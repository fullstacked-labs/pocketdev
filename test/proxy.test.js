import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createMasqueradeProxy } from '../src/proxy.js';
import { isPortOpen, detectDevPorts, findFreePort } from '../src/port.js';

test('Proxy rewrites request headers (Host, Origin, Referer, x-forwarded-proto, sec-fetch-site)', async (t) => {
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

  // 2. DevHop masquerade proxy
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
      Referer: 'https://mock.trycloudflare.com/settings',
      'Sec-Fetch-Site': 'cross-site'
    }
  });

  assert.ok(capturedHeaders, 'Backend should have received request');
  assert.strictEqual(capturedHeaders.host, `localhost:${backendPort}`, 'Host must be masqueraded to localhost:<port>');
  assert.strictEqual(capturedHeaders.origin, `https://localhost:${backendPort}`, 'Origin must match https protocol');
  assert.strictEqual(capturedHeaders.referer, `https://localhost:${backendPort}/`, 'Referer must be masqueraded to https://localhost:<port>/');
  assert.strictEqual(capturedHeaders['sec-fetch-site'], 'same-origin', 'sec-fetch-site must be normalized to same-origin');
  assert.strictEqual(capturedHeaders['x-forwarded-proto'], 'https', 'x-forwarded-proto must be https');
  assert.strictEqual(capturedHeaders['x-forwarded-ssl'], 'on', 'x-forwarded-ssl must be on');
  assert.strictEqual(capturedHeaders['x-forwarded-host'], `localhost:${backendPort}`, 'x-forwarded-host must be localhost:<port>');
});

test('Proxy rewrites both http:// and https:// Location headers in redirects', async (t) => {
  const backendPort = await findFreePort();
  const proxyPort = await findFreePort();
  const publicTunnelUrl = 'https://cool-tunnel-name.trycloudflare.com';

  // 1. Mock backend returning both http and https redirects
  let redirectCount = 0;
  const backend = http.createServer((req, res) => {
    redirectCount++;
    const scheme = redirectCount === 1 ? 'http' : 'https';
    res.writeHead(302, {
      Location: `${scheme}://localhost:${backendPort}/dashboard?param=test#section`
    });
    res.end();
  });

  await new Promise((r) => backend.listen(backendPort, '127.0.0.1', r));

  // 2. DevHop masquerade proxy
  const { server: proxyServer } = createMasqueradeProxy({
    targetPort: backendPort,
    getPublicUrl: () => publicTunnelUrl
  });

  await new Promise((r) => proxyServer.listen(proxyPort, '127.0.0.1', r));

  t.after(() => {
    backend.close();
    proxyServer.close();
  });

  // Test 1: http redirect rewrite
  let res = await fetch(`http://127.0.0.1:${proxyPort}/login`, { redirect: 'manual' });
  assert.strictEqual(res.status, 302);
  assert.strictEqual(
    res.headers.get('location'),
    `${publicTunnelUrl}/dashboard?param=test#section`,
    'http:// redirect must be rewritten to public tunnel URL'
  );

  // Test 2: https redirect rewrite
  res = await fetch(`http://127.0.0.1:${proxyPort}/login`, { redirect: 'manual' });
  assert.strictEqual(res.status, 302);
  assert.strictEqual(
    res.headers.get('location'),
    `${publicTunnelUrl}/dashboard?param=test#section`,
    'https:// redirect must be rewritten to public tunnel URL'
  );
});

test('Proxy rewrites Access-Control-Allow-Origin response header to public tunnel URL', async (t) => {
  const backendPort = await findFreePort();
  const proxyPort = await findFreePort();
  const publicTunnelUrl = 'https://cors-test.trycloudflare.com';

  const backend = http.createServer((req, res) => {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': `https://localhost:${backendPort}`,
      'Access-Control-Allow-Credentials': 'true'
    });
    res.end('ok');
  });
  // 2. DevHop masquerade proxy
  await new Promise((r) => backend.listen(backendPort, '127.0.0.1', r));

  const { server: proxyServer } = createMasqueradeProxy({
    targetPort: backendPort,
    getPublicUrl: () => publicTunnelUrl
  });

  await new Promise((r) => proxyServer.listen(proxyPort, '127.0.0.1', r));

  t.after(() => {
    backend.close();
    proxyServer.close();
  });

  const res = await fetch(`http://127.0.0.1:${proxyPort}/api/data`);
  assert.strictEqual(
    res.headers.get('access-control-allow-origin'),
    publicTunnelUrl,
    'Access-Control-Allow-Origin must be rewritten to the public tunnel URL'
  );
});

test('Proxy strips Domain=localhost and Domain=.localhost from response Set-Cookie headers', async (t) => {
  const backendPort = await findFreePort();
  const proxyPort = await findFreePort();

  const backend = http.createServer((req, res) => {
    res.setHeader('Set-Cookie', [
      `session_token=secret123; Domain=localhost; Path=/; HttpOnly; SameSite=Lax`,
      `dotted_cookie=abc; Domain=.localhost; Path=/`,
      `ipv6_cookie=xyz; domain=[::1]; Path=/`
    ]);
    res.writeHead(200);
    res.end('ok');
  });

  await new Promise((r) => backend.listen(backendPort, '127.0.0.1', r));

  const { server: proxyServer } = createMasqueradeProxy({
    targetPort: backendPort,
    getPublicUrl: () => 'https://mock.trycloudflare.com'
  });

  await new Promise((r) => proxyServer.listen(proxyPort, '127.0.0.1', r));

  t.after(() => {
    backend.close();
    proxyServer.close();
  });

  const res = await fetch(`http://127.0.0.1:${proxyPort}/test`);
  const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];

  assert.strictEqual(rawCookies.length, 3);
  assert.ok(!rawCookies[0].includes('Domain=localhost'), 'Domain=localhost must be stripped');
  assert.ok(!rawCookies[1].includes('Domain=.localhost'), 'Domain=.localhost must be stripped');
  assert.ok(!rawCookies[2].includes('domain=[::1]'), 'domain=[::1] must be stripped');
  assert.ok(rawCookies[0].includes('Path=/'), 'Path attribute must remain intact');
});

test('Port probing and auto-detection identifies open dev server ports', async (t) => {
  const testPort = await findFreePort();
  const unusedPort = await findFreePort();

  const beforeListen = await isPortOpen(testPort);
  assert.strictEqual(beforeListen, false, 'Port should be closed before server start');

  const server = http.createServer((req, res) => res.end('ok'));
  await new Promise((r) => server.listen(testPort, '127.0.0.1', r));

  t.after(() => server.close());

  const afterListen = await isPortOpen(testPort);
  assert.strictEqual(afterListen, true, 'Port should be detected as open');

  const detected = await detectDevPorts([testPort, unusedPort]);
  assert.deepStrictEqual(detected, [testPort], 'Should only detect active listening port');
});
