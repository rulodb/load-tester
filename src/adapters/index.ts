import { type DatabaseAdapter } from './adapter';
import { RethinkDBAdapter } from './rethinkdb';
import { RuloDBAdapter } from './rulodb';

export type { DatabaseAdapter };
export { RethinkDBAdapter, RuloDBAdapter };

export enum AdapterType {
  RULODB = 'rulodb',
  RETHINKDB = 'rethinkdb'
}
