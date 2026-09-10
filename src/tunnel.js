import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { install } from 'cloudflared/lib/install.js';

export function getBinPath() {
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'cloudflared.exe' : 'cloudflared';

  const cacheDir = process.env.XDG_CACHE_HOME
    ? path.join(process.env.XDG_CACHE_HOME, 'pocketdev', 'bin')
    : path.join(os.homedir(), '.cache', 'pocketdev', 'bin');

  return path.join(cacheDir, binName);
}

export async function ensureBinary(onProgress) {
  const binPath = getBinPath();
  if (fs.existsSync(binPath)) {
    return binPath;
  }

  const dir = path.dirname(binPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (onProgress) onProgress('Downloading cloudflared binary (one-time setup)...');
  await install(binPath);
  return binPath;
}

export function startTunnel({ localPort, binPath, onUrl, onError, onClose }) {
  const child = spawn(binPath, ['tunnel', '--url', `http://127.0.0.1:${localPort}`], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let urlFound = false;

  const handleOutput = (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match && !urlFound) {
      urlFound = true;
      if (onUrl) onUrl(match[0]);
    }
  };

  child.stdout.on('data', handleOutput);
  child.stderr.on('data', handleOutput);

  if (onError) child.on('error', onError);
  if (onClose) child.on('close', onClose);

  return {
    child,
    close: () => {
      try { child.kill('SIGTERM'); } catch (_) {}
    }
  };
}
