#!/usr/bin/env node
/**
 * Poll TCP until PostgreSQL accepts connections on the host/port from DATABASE_URL.
 * Reads repo root `.env` (same convention as api/loadEnv.js); falls back to Docker defaults.
 */
'use strict';

const fs = require('fs');
const net = require('net');
const path = require('path');

const ROOT = path.join(__dirname, '..');
/** Fallback when `.env` is missing — host/port only matter for the TCP check. */
const DEFAULT_URL = 'postgresql://127.0.0.1:5432/antivaxxer_dev';

function readDatabaseUrl() {
  const envFile = path.join(ROOT, '.env');
  try {
    const content = fs.readFileSync(envFile, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      if (trimmed.startsWith('DATABASE_URL=')) {
        let v = trimmed.slice('DATABASE_URL='.length).trim();
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1);
        }
        return v;
      }
    }
  } catch (_) {
    /* no .env */
  }
  return process.env.DATABASE_URL || DEFAULT_URL;
}

function parseHostPort(urlString) {
  const u = new URL(urlString);
  return {
    host: u.hostname || 'localhost',
    port: Number(u.port) || 5432,
  };
}

function tryConnect(host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port }, () => {
      socket.end();
      resolve();
    });
    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('timeout'));
    });
    socket.on('error', reject);
  });
}

async function main() {
  const url = readDatabaseUrl();
  const { host, port } = parseHostPort(url);
  const deadline = Date.now() + 60000;
  process.stderr.write(`Waiting for PostgreSQL at ${host}:${port}...\n`);
  while (Date.now() < deadline) {
    try {
      await tryConnect(host, port, 3000);
      process.stderr.write('PostgreSQL is accepting connections.\n');
      process.exit(0);
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  process.stderr.write(
    'Timed out waiting for PostgreSQL. Start Postgres locally, create `antivaxxer_dev`, and check DATABASE_URL in `.env`.\n'
  );
  process.exit(1);
}

main();
