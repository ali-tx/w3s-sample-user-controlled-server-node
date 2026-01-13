import { Database } from 'sqlite3';
import { ContractDAO, ContractRecord } from '../dao/contractDAO';
import { logger } from '../../logging/logger';

export class SqliteContractDAO implements ContractDAO {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  insertContract(rec: ContractRecord) {
    this.db.serialize(() => {
      this.db.run(
        'INSERT INTO contracts (id, userId, name, contractAddress, artifactPath, status, walletAddress, contractId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET contractAddress=excluded.contractAddress, artifactPath=excluded.artifactPath, status=excluded.status, walletAddress=excluded.walletAddress, contractId=excluded.contractId',
        [
          rec.id,
          rec.userId,
          rec.name,
          rec.contractAddress ?? null,
          rec.artifactPath ?? null,
          rec.status ?? null,
          rec.walletAddress ?? null,
          rec.contractId ?? null
        ],
        function (err) {
          if (err) {
            logger.error('Error inserting contract', err);
          }
        }
      );
    });
  }

  async getContractsByUser(userId: string): Promise<ContractRecord[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM contracts WHERE userId = ?',
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as ContractRecord[]);
        }
      );
    });
  }
}
