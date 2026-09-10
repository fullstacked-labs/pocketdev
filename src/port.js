import net from 'node:net';

/**
 * Checks whether a TCP port is open and accepting connections.
 * @param {number} port
 * @param {string} [host='127.0.0.1']
 * @param {number} [timeout=300]
 * @returns {Promise<boolean>}
 */
export function isPortOpen(port, host = '127.0.0.1', timeout = 300) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = false;

    socket.setTimeout(timeout);
    socket.once('connect', () => {
      status = true;
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Scans standard dev ports to auto-detect running servers.
 * @param {number[]} [candidates=[3000, 5173, 8080, 4321, 30178]]
 * @returns {Promise<number[]>} List of active ports
 */
export async function detectDevPorts(candidates = [3000, 5173, 8080, 4321, 30178]) {
  const results = await Promise.all(
    candidates.map(async (port) => ({
      port,
      open: await isPortOpen(port)
    }))
  );
  return results.filter((r) => r.open).map((r) => r.port);
}

/**
 * Finds an available ephemeral port on loopback.
 * @returns {Promise<number>}
 */
export function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}
