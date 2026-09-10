import http from 'node:http';
import httpProxy from 'http-proxy';

/**
 * Creates a reverse proxy that masquerades Host, Origin, and Referer headers
 * to localhost:<targetPort> and rewrites response Location and Set-Cookie headers.
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
    xfwd: true
  });

  const rewriteRequestHeaders = (proxyReq, req) => {
    proxyReq.setHeader('Host', `localhost:${targetPort}`);
    if (req.headers.origin) {
      proxyReq.setHeader('Origin', `https://localhost:${targetPort}`);
    } else {
      proxyReq.removeHeader('Origin');
    }
    if (req.headers.referer) {
      proxyReq.setHeader('Referer', `https://localhost:${targetPort}/`);
    }
    if (req.headers['sec-fetch-site']) {
      proxyReq.setHeader('sec-fetch-site', 'same-origin');
    }
    proxyReq.setHeader('x-forwarded-proto', 'https');
    proxyReq.setHeader('x-forwarded-ssl', 'on');
  };
  proxy.on('proxyReq', rewriteRequestHeaders);
  proxy.on('proxyReqWs', rewriteRequestHeaders);

  // Intercept response headers to rewrite Location and Set-Cookie
  proxy.on('proxyRes', (proxyRes) => {
    // 1. Rewrite Location header in redirects (OAuth, Server Actions, form submissions)
    if (proxyRes.headers.location) {
      const publicUrl = getPublicUrl();
      if (publicUrl) {
        // Rewrite http://localhost:<port> or http://127.0.0.1:<port> to publicUrl
        proxyRes.headers.location = proxyRes.headers.location.replace(
          new RegExp(`^http://(localhost|127\\.0\\.0\\.1)(:${targetPort})?`, 'i'),
          publicUrl
        );
      }
    }

    // 2. Rewrite Set-Cookie to strip Domain=localhost so mobile browsers accept cookies
    if (proxyRes.headers['set-cookie']) {
      const cookies = Array.isArray(proxyRes.headers['set-cookie'])
        ? proxyRes.headers['set-cookie']
        : [proxyRes.headers['set-cookie']];

      proxyRes.headers['set-cookie'] = cookies.map((cookie) => {
        // Remove Domain=localhost or Domain=127.0.0.1 (case insensitive)
        return cookie.replace(/;\s*domain=(localhost|127\.0\.0\.1)/gi, '');
      });
    }
  });

  proxy.on('error', (err, req, res) => {
    if (res && res.writeHead && !res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(`pocketdev: Target server not responding on port ${targetPort}`);
    }
  });

  const server = http.createServer((req, res) => {
    proxy.web(req, res);
  });

  server.on('upgrade', (req, socket, head) => {
    proxy.ws(req, socket, head);
  });

  return { server, proxy };
}
