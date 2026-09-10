import http from 'node:http';
import httpProxy from 'http-proxy';

/**
 * Creates a reverse proxy that masquerades Host, Origin, and Referer headers
 * to localhost:<targetPort> and rewrites response Location, Access-Control-Allow-Origin,
 * and Set-Cookie headers.
 *
 * @param {Object} options
 * @param {number} options.targetPort - Local dev server port to proxy to
 * @param {string} [options.targetHost='127.0.0.1'] - Local dev server host
 * @param {() => string | null} [options.getPublicUrl] - Function returning current public tunnel URL
 * @returns {{ server: http.Server, proxy: httpProxy }}
 */
export function createMasqueradeProxy({
  targetPort,
  targetHost = '127.0.0.1',
  getPublicUrl = () => null
}) {
  const proxy = httpProxy.createProxyServer({
    target: `http://${targetHost}:${targetPort}`,
    ws: true,
    changeOrigin: true,
    xfwd: false // Managed explicitly below to avoid leaking public tunnel host
  });

  const rewriteRequestHeaders = (proxyReq, req) => {
    // 1. Masquerade Host and x-forwarded headers to localhost so dev servers treat connection as local
    proxyReq.setHeader('Host', `localhost:${targetPort}`);
    proxyReq.setHeader('x-forwarded-host', `localhost:${targetPort}`);
    proxyReq.setHeader('x-forwarded-proto', 'https');
    proxyReq.setHeader('x-forwarded-ssl', 'on');

    // 2. Align Origin with https protocol (prevents Next.js cross-origin API rejections)
    if (req.headers.origin) {
      proxyReq.setHeader('Origin', `https://localhost:${targetPort}`);
    } else {
      proxyReq.removeHeader('Origin');
    }

    // 3. Align Referer with https protocol
    if (req.headers.referer) {
      proxyReq.setHeader('Referer', `https://localhost:${targetPort}/`);
    }

    // 4. Normalize sec-fetch-site to same-origin
    if (req.headers['sec-fetch-site']) {
      proxyReq.setHeader('sec-fetch-site', 'same-origin');
    }
  };

  proxy.on('proxyReq', rewriteRequestHeaders);
  proxy.on('proxyReqWs', rewriteRequestHeaders);

  // Intercept response headers to rewrite Location, CORS, and Set-Cookie
  proxy.on('proxyRes', (proxyRes) => {
    const publicUrl = getPublicUrl();

    // 1. Rewrite Location header in redirects (OAuth, Server Actions, form submissions)
    // Matches both http:// and https:// across localhost, 127.0.0.1, 0.0.0.0, and [::1]
    if (proxyRes.headers.location && publicUrl) {
      proxyRes.headers.location = proxyRes.headers.location.replace(
        new RegExp(`^https?://(\\.?(localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0|\\[::1\\]))(:${targetPort})?(?=/|$)`, 'i'),
        publicUrl
      );
    }

    // 2. Rewrite Access-Control-Allow-Origin if backend reflects localhost origin
    const acao = proxyRes.headers['access-control-allow-origin'];
    if (acao && publicUrl) {
      if (acao.includes('localhost') || acao.includes('127.0.0.1') || acao.includes('0.0.0.0') || acao.includes('[::1]')) {
        proxyRes.headers['access-control-allow-origin'] = publicUrl;
      }
    }

    // 3. Rewrite Set-Cookie to strip Domain=localhost (including leading dots) so mobile browsers store cookies
    if (proxyRes.headers['set-cookie']) {
      const cookies = Array.isArray(proxyRes.headers['set-cookie'])
        ? proxyRes.headers['set-cookie']
        : [proxyRes.headers['set-cookie']];

      proxyRes.headers['set-cookie'] = cookies.map((cookie) => {
        return cookie.replace(/;\s*domain=(\.?(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]))/gi, '');
      });
    }
  });

  // Handle proxy errors and ignore client connection drop (e.g. mobile screen lock)
  proxy.on('error', (err, req, res) => {
    if (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === 'ECANCELED') {
      return;
    }
    if (res && res.writeHead && !res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(`devhop: Target server not responding on port ${targetPort}`);
    }
  });

  const server = http.createServer((req, res) => {
    proxy.web(req, res);
  });

  server.on('upgrade', (req, socket, head) => {
    proxy.ws(req, socket, head);
  });

  // Ignore client socket errors on the HTTP server itself
  server.on('clientError', (err, socket) => {
    if (err.code === 'ECONNRESET' || !socket.writable) {
      return;
    }
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  return { server, proxy };
}
