export type Callback = (conn: unknown) => Promise<void>;

export interface DatabaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  run(cb: Callback): Promise<unknown>;
}
