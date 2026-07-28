import {
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
} from "@nestjs/common";
import {
  createDatabaseClient,
  type DatabaseClient,
} from "@travel-bingo/database";

import { readApiEnvironment } from "../config/environment.js";

export const DATABASE_CLIENT = Symbol("DATABASE_CLIENT");

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CLIENT,
      useFactory: (): DatabaseClient =>
        createDatabaseClient({
          connectionString: readApiEnvironment().databaseUrl,
        }),
    },
  ],
  exports: [DATABASE_CLIENT],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.database.$disconnect();
  }
}
