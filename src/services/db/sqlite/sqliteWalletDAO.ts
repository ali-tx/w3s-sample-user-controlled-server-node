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
import { Wallet } from '../../../middleware/types/wallet';
import { WalletDAO } from '../dao/walletDAO';

export class SqliteWalletDAO implements WalletDAO {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  getWalletsByUserId(
    userId: string,
    callback: (err: Error | null, rows: Wallet[]) => Promise<void>
  ) {
    this.db.all('SELECT * FROM wallets WHERE userId = ?', [userId], callback);
  }

  insertWallet(wallet: Wallet) {
    this.db.serialize(() => {
      this.db.run(
        'INSERT INTO wallets (id, userId, blockchain, address, state, custodyType, refId, createDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
        [
          wallet.id,
          wallet.userId,
          wallet.blockchain,
          wallet.address,
          wallet.state,
          wallet.custodyType,
          wallet.refId,
          wallet.createDate
        ]
      );
    });
  }

  getWalletById(
    id: string,
    callback: (err: Error | null, rows: Wallet[]) => Promise<void>
  ) {
    this.db.all('SELECT * FROM wallets WHERE id = ?', [id], callback);
  }
}
