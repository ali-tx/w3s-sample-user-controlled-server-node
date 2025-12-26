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
import { Transaction } from '../../../middleware/types/transaction';
import { TransactionDAO } from '../dao/transactionDAO';

export class SqliteTransactionDAO implements TransactionDAO {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  getTransactionsByUserId(
    userId: string,
    callback: (err: Error | null, rows: Transaction[]) => Promise<void>
  ) {
    this.db.all(
      'SELECT * FROM transactions WHERE userId = ?',
      [userId],
      callback
    );
  }

  insertTransaction(transaction: Transaction) {
    this.db.serialize(() => {
      this.db.run(
        'INSERT INTO transactions (id, userId, walletId, tokenId, destinationAddress, amounts, transactionType, state, createDate, updateDate, refId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
        [
          transaction.id,
          transaction.userId,
          transaction.walletId,
          transaction.tokenId,
          transaction.destinationAddress,
          JSON.stringify(transaction.amounts),
          transaction.transactionType,
          transaction.state,
          transaction.createDate,
          transaction.updateDate,
          transaction.refId
        ]
      );
    });
  }

  getTransactionById(
    id: string,
    callback: (err: Error | null, rows: Transaction[]) => Promise<void>
  ) {
    this.db.all('SELECT * FROM transactions WHERE id = ?', [id], callback);
  }
}
