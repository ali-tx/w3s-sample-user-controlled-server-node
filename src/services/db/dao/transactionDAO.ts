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

import { Transaction } from '../../../middleware';

export interface TransactionDAO {
  getTransactionsByUserId: (
    userId: string,
    callback: (err: Error | null, rows: Transaction[]) => Promise<void>
  ) => void;
  insertTransaction: (transaction: Transaction) => void;
  getTransactionById: (
    id: string,
    callback: (err: Error | null, rows: Transaction[]) => Promise<void>
  ) => void;
}

export let transactionDAO: TransactionDAO;

export const registerTransactionDAO = (newTransactionDAO: TransactionDAO) => {
  transactionDAO = newTransactionDAO;
};
