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

import { Database } from 'sqlite3';
import { registerUserDAO } from '../dao';
import { SqliteUserDAO } from './sqliteUserDAO';
import { registerContractDAO } from '../dao';
import { SqliteContractDAO } from './sqliteContractDAO';
import { logger } from '../../logging/logger';

const DATABASE_FILENAME = process.env.DATABASE_FILENAME || ':memory:';
const client = new Database(DATABASE_FILENAME);
const userDAO = new SqliteUserDAO(client);
const contractDAO = new SqliteContractDAO(client);
let dbClosed = false;

export const createUserTable = (db: Database) => {
  db.serialize(() => {
    db.exec(
      'CREATE TABLE IF NOT EXISTS users (userId TEXT PRIMARY KEY, email TEXT UNIQUE, password TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)'
    );
  });
};

export const createContractsTable = (db: Database) => {
  db.serialize(() => {
    db.exec(
      'CREATE TABLE IF NOT EXISTS contracts (id TEXT PRIMARY KEY, userId TEXT, name TEXT, contractAddress TEXT, artifactPath TEXT, status TEXT, walletAddress TEXT, contractId TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)'
    );
    // Add columns if not exists
    db.run('ALTER TABLE contracts ADD COLUMN walletAddress TEXT', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding walletAddress column:', err);
      }
    });
  });
};

export const initDB = () => {
  registerUserDAO(userDAO);
  registerContractDAO(contractDAO);
  createUserTable(client);
  createContractsTable(client);
  logger.info('Created users table');
};

export const cleanupDB = () => {
  if (dbClosed) {
    logger.info('cleanupDB called but DB already closed');
    return;
  }
  dbClosed = true;
  try {
    client.close((err) => {
      if (err) {
        return logger.error(err.message);
      }
      logger.info('Database connection closed successfully');
    });
  } catch (err: unknown) {
    logger.error(
      'Error closing database: ' + ((err as Error)?.message || String(err))
    );
  }
};
