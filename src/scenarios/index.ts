import { AdapterType } from '../adapters';
import { RethinkDBBalancedReadWriteScenario } from './rethinkdb/balanced-read-write';
import { RethinkDBBasicInsertScenario } from './rethinkdb/basic-insert';
import { RethinkDBBulkInsertScenario } from './rethinkdb/bulk-insert';
import { RethinkDBReadHeavyScenario } from './rethinkdb/read-heavy';
import { RethinkDBWriteHeavyScenario } from './rethinkdb/write-heavy';
import { RuloDBBalancedReadWriteScenario } from './rulodb/balanced-read-write';
import { RuloDBBasicInsertScenario } from './rulodb/basic-insert';
import { RuloDBBulkInsertScenario } from './rulodb/bulk-insert';
import { RuloDBReadHeavyScenario } from './rulodb/read-heavy';
import { RuloDBWriteHeavyScenario } from './rulodb/write-heavy';
import type { Scenario } from './scenario';

export function createScenarios(batchSize?: number): Record<string, Record<string, Scenario>> {
  return {
    'basic-insert': {
      [AdapterType.RETHINKDB]: new RethinkDBBasicInsertScenario(),
      [AdapterType.RULODB]: new RuloDBBasicInsertScenario()
    },
    'bulk-insert': {
      [AdapterType.RETHINKDB]: new RethinkDBBulkInsertScenario(batchSize),
      [AdapterType.RULODB]: new RuloDBBulkInsertScenario(batchSize)
    },
    'balanced-read-write': {
      [AdapterType.RETHINKDB]: new RethinkDBBalancedReadWriteScenario(),
      [AdapterType.RULODB]: new RuloDBBalancedReadWriteScenario()
    },
    'read-heavy': {
      [AdapterType.RETHINKDB]: new RethinkDBReadHeavyScenario(),
      [AdapterType.RULODB]: new RuloDBReadHeavyScenario()
    },
    'write-heavy': {
      [AdapterType.RETHINKDB]: new RethinkDBWriteHeavyScenario(),
      [AdapterType.RULODB]: new RuloDBWriteHeavyScenario()
    }
  };
}

export const scenarios = createScenarios();
