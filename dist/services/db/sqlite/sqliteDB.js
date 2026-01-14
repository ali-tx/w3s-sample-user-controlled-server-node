"use strict";
// Copyright (c) 2024, Circle Technologies, LLC. All rights reserved.
//
// SPDX-License-Identifier: Apache-2.0
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupDB = exports.initDB = exports.createContractsTable = exports.createUserTable = void 0;
const sqlite3_1 = require("sqlite3");
const dao_1 = require("../dao");
const sqliteUserDAO_1 = require("./sqliteUserDAO");
const dao_2 = require("../dao");
const sqliteContractDAO_1 = require("./sqliteContractDAO");
const logger_1 = require("../../logging/logger");
const DATABASE_FILENAME = process.env.DATABASE_FILENAME || ':memory:';
const client = new sqlite3_1.Database(DATABASE_FILENAME);
const userDAO = new sqliteUserDAO_1.SqliteUserDAO(client);
const contractDAO = new sqliteContractDAO_1.SqliteContractDAO(client);
let dbClosed = false;
const createUserTable = (db) => {
    db.serialize(() => {
        db.exec('CREATE TABLE IF NOT EXISTS users (userId TEXT PRIMARY KEY, email TEXT UNIQUE, password TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)');
    });
};
exports.createUserTable = createUserTable;
const createContractsTable = (db) => {
    db.serialize(() => {
        db.exec('CREATE TABLE IF NOT EXISTS contracts (id TEXT PRIMARY KEY, userId TEXT, name TEXT, contractAddress TEXT, artifactPath TEXT, status TEXT, walletAddress TEXT, contractId TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)');
        // Add columns if not exists
        db.run('ALTER TABLE contracts ADD COLUMN walletAddress TEXT', (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding walletAddress column:', err);
            }
        });
    });
};
exports.createContractsTable = createContractsTable;
const initDB = () => {
    (0, dao_1.registerUserDAO)(userDAO);
    (0, dao_2.registerContractDAO)(contractDAO);
    (0, exports.createUserTable)(client);
    (0, exports.createContractsTable)(client);
    logger_1.logger.info('Created users table');
};
exports.initDB = initDB;
const cleanupDB = () => {
    if (dbClosed) {
        logger_1.logger.info('cleanupDB called but DB already closed');
        return;
    }
    dbClosed = true;
    try {
        client.close((err) => {
            if (err) {
                return logger_1.logger.error(err.message);
            }
            logger_1.logger.info('Database connection closed successfully');
        });
    }
    catch (err) {
        logger_1.logger.error('Error closing database: ' + (err?.message || String(err)));
    }
};
exports.cleanupDB = cleanupDB;
