import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client.js";

export interface DatabaseClientOptions {
  readonly connectionString: string;
}

export function createDatabaseClient(
  options: DatabaseClientOptions,
): PrismaClient {
  const adapter = new PrismaPg({ connectionString: options.connectionString });

  return new PrismaClient({ adapter });
}

export type DatabaseClient = PrismaClient;
