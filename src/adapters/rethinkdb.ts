import { type Connection, r } from 'rethinkdb-ts';

import type { Callback, DatabaseAdapter } from './adapter';

export class RethinkDBAdapter implements DatabaseAdapter {
  private conn!: Connection;

  async connect() {
    // TODO: This could be a connection pool instead
    this.conn = await r.connect({ host: '127.0.0.1', port: 28015 });
  }

  async disconnect() {
    await this.conn.close();
  }

  async run(cb: Callback) {
    return cb(this.conn);
  }
}
