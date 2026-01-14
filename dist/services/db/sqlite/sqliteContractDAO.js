"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteContractDAO = void 0;
const logger_1 = require("../../logging/logger");
class SqliteContractDAO {
    constructor(db) {
        this.db = db;
    }
    insertContract(rec) {
        this.db.serialize(() => {
            this.db.run('INSERT INTO contracts (id, userId, name, contractAddress, artifactPath, status, walletAddress, contractId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET contractAddress=excluded.contractAddress, artifactPath=excluded.artifactPath, status=excluded.status, walletAddress=excluded.walletAddress, contractId=excluded.contractId', [
                rec.id,
                rec.userId,
                rec.name,
                rec.contractAddress ?? null,
                rec.artifactPath ?? null,
                rec.status ?? null,
                rec.walletAddress ?? null,
                rec.contractId ?? null
            ], function (err) {
                if (err) {
                    logger_1.logger.error('Error inserting contract', err);
                }
            });
        });
    }
    async getContractsByUser(userId) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM contracts WHERE userId = ?', [userId], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows);
            });
        });
    }
}
exports.SqliteContractDAO = SqliteContractDAO;
