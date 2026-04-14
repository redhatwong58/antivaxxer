/**
 * Prisma Client Singleton
 *
 * In development, hot reloading creates new PrismaClient instances
 * on every reload, eventually exhausting the database connection pool.
 * This singleton pattern reuses the client across hot reloads.
 *
 * In production, a single instance is created and reused.
 */

const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // Reuse client across hot reloads in development
  if (!global.__prismaClient) {
    global.__prismaClient = new PrismaClient({
      log: ['query', 'warn', 'error'],
    });
  }
  prisma = global.__prismaClient;
}

module.exports = { prisma };
