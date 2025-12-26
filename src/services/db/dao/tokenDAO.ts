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

import { Token } from '../../../middleware';

export interface TokenDAO {
  getAllTokens: (
    callback: (err: Error | null, rows: Token[]) => Promise<void>
  ) => void;
  insertToken: (token: Token) => void;
  getTokenById: (
    id: string,
    callback: (err: Error | null, rows: Token[]) => Promise<void>
  ) => void;
}

export let tokenDAO: TokenDAO;

export const registerTokenDAO = (newTokenDAO: TokenDAO) => {
  tokenDAO = newTokenDAO;
};
