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
import {
  registerUserDAO,
  registerWalletDAO,
  registerTransactionDAO,
  registerTokenDAO
} from '../dao';
import { SqliteUserDAO } from './sqliteUserDAO';
import { SqliteWalletDAO } from './sqliteWalletDAO';
import { SqliteTransactionDAO } from './sqliteTransactionDAO';
import { SqliteTokenDAO } from './sqliteTokenDAO';
import { logger } from '../../logging/logger';

const client = new Database(process.env.DATABASE_FILENAME ?? ':memory:');
const userDAO = new SqliteUserDAO(client);
const walletDAO = new SqliteWalletDAO(client);
const transactionDAO = new SqliteTransactionDAO(client);
const tokenDAO = new SqliteTokenDAO(client);

export const createUserTable = (db: Database) => {
  db.serialize(() => {
    db.exec(
      'CREATE TABLE IF NOT EXISTS users (userId TEXT PRIMARY KEY, email TEXT UNIQUE, password TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)'
    );
  });
};

export const createWalletTable = (db: Database) => {
  db.serialize(() => {
    db.exec(
      'CREATE TABLE IF NOT EXISTS wallets (id TEXT PRIMARY KEY, userId TEXT, blockchain TEXT, address TEXT, state TEXT, custodyType TEXT, refId TEXT, createDate TEXT)'
    );
  });
};

export const createTransactionTable = (db: Database) => {
  db.serialize(() => {
    db.exec(
      'CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, userId TEXT, walletId TEXT, tokenId TEXT, destinationAddress TEXT, amounts TEXT, transactionType TEXT, state TEXT, createDate TEXT, updateDate TEXT, refId TEXT)'
    );
  });
};

export const createTokenTable = (db: Database) => {
  db.serialize(() => {
    db.exec(
      'CREATE TABLE IF NOT EXISTS tokens (id TEXT PRIMARY KEY, blockchain TEXT, symbol TEXT, name TEXT, decimals INTEGER, isNative INTEGER, contractAddress TEXT, updateDate TEXT)'
    );
  });
};

export const initDB = () => {
  registerUserDAO(userDAO);
  registerWalletDAO(walletDAO);
  registerTransactionDAO(transactionDAO);
  registerTokenDAO(tokenDAO);
  createUserTable(client);
  createWalletTable(client);
  createTransactionTable(client);
  createTokenTable(client);
  logger.info('Created database tables');
};

export const cleanupDB = () => {
  client.close((err) => {
    if (err) {
      return logger.error(err.message);
    }
    logger.info('Database connection closed successfully');
  });
};
