import { open, type QuickSQLiteConnection } from 'react-native-quick-sqlite';
import { INITIAL_SCHEMA, MIGRATIONS } from './schema';

let dbInstance: QuickSQLiteConnection | null = null;

function runStatements(db: QuickSQLiteConnection, sqlBlob: string): void {
  const parts = sqlBlob
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const part of parts) {
    db.execute(part + ';');
  }
}

export async function getDatabase(): Promise<QuickSQLiteConnection> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = open({ name: 'wastebank.db' });
  runStatements(dbInstance, INITIAL_SCHEMA);

  const versionResult = dbInstance.execute('PRAGMA user_version;');
  const row = versionResult.rows?._array?.[0];
  const currentVersion =
    row?.user_version != null ? Number(row.user_version) : 0;

  for (let i = currentVersion; i < MIGRATIONS.length; i++) {
    runStatements(dbInstance, MIGRATIONS[i].trim());
    dbInstance.execute('PRAGMA user_version = ?;', [i + 1]);
  }

  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export async function checkIntegrity(): Promise<boolean> {
  const db = await getDatabase();
  try {
    const result = db.execute('PRAGMA integrity_check;');
    const status = result.rows?._array?.[0]?.integrity_check;
    return status === 'ok';
  } catch {
    return false;
  }
}
