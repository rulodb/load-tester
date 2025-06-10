import { Client } from '@rulodb/rulodb';

import type { Callback, DatabaseAdapter } from './adapter';

export class RuloDBAdapter implements DatabaseAdapter {
  private client!: Client;

  async connect() {
    this.client = new Client({ host: '127.0.0.1', port: 6969 });
  }

  async disconnect() {
    await this.client.close();
  }

  async run(cb: Callback) {
    return cb(this.client);
  }
}
