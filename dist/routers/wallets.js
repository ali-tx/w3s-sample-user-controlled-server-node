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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wallets = void 0;
const express_1 = __importDefault(require("express"));
const middleware_1 = require("../middleware");
const controllers_1 = require("../controllers");
const yup = __importStar(require("yup"));
const wallets = express_1.default.Router();
exports.wallets = wallets;
/**
 * GET - /wallets
 * Returns wallets for a specific user
 *
 * Params:
 *  blockchain: string   - filter by blockchain.
 *  walletSetId: string  - filter by the wallet set the wallet belongs to.
 *  userId: string       - filter by external user ID filters.
 *  address: string      - filter by the Address of the wallet.
 *  refId: string        - filter by the reference identifier set on the wallet.
 *  from: date           - queries items created since the specified
 *                         date-time (inclusive).
 *  to: date             - queries items created before the specified
 *                         date-time (inclusive).
 *  pageBefore: string   - A collection ID value used for pagination.
 *                         It marks the exclusive end of a page. When
 *                         provided, the collection resource will return
 *                         the next n items before the id, with n being
 *                         specified by pageSize.
 *  pageAfter: string    - A collection ID value used for pagination.
 *                         It marks the exclusive begin of a page. When
 *                         provided, the collection resource will return
 *                         the next n items after the id, with n being
 *                         specified by pageSize.
 *  pageSize: string     - Limits the number of items to be returned.
 *                         Some collections have a strict upper bound
 *                         that will disregard this value. In case the
 *                         specified value is higher than the allowed
 *                         limit, the collection limit will be used.
 *
 * Returns:
 *  wallets: [wallet] - array of the wallet information.
 *                               Read more about 'wallet':
 *                               https://developers.circle.com/w3s/reference/listwallets
 *
 */
wallets.get('/', (0, middleware_1.validate)(middleware_1.listWalletsSchema), controllers_1.listWallets);
/**
 * GET - /wallets/:id/balances
 * Returns wallets balances information for a given wallet
 *
 * Params:
 *  id: string               - ID in url path for the specific wallet.
 *  userId: string           - the UUID of the wallet's owner. Used to identify user if
 *                             no userToken is provided.
 *  includeAll: bool         - include all tokens.
 *  name: string             - used to filter by token name.
 *  tokenAddresses: [string] - used to filter by token addresses.
 *  standard: string         - used to filter by token standard. Ex. ERC20
 *  from: date               - queries items created since the specified
 *                             date-time (inclusive).
 *  to: date                 - queries items created before the specified
 *                             date-time (inclusive).
 *  pageBefore: string       - A collection ID value used for pagination.
 *                             It marks the exclusive end of a page. When
 *                             provided, the collection resource will return
 *                             the next n items before the id, with n being
 *                             specified by pageSize.
 *  pageAfter: string        - A collection ID value used for pagination.
 *                             It marks the exclusive begin of a page. When
 *                             provided, the collection resource will return
 *                             the next n items after the id, with n being
 *                             specified by pageSize.
 *  pageSize: string         - Limits the number of items to be returned.
 *                             Some collections have a strict upper bound
 *                             that will disregard this value. In case the
 *                             specified value is higher than the allowed
 *                             limit, the collection limit will be used.
 *
 * Returns:
 *  tokenBalances: [tokenInfo] - array of the token amount information.
 *                               Read more about 'tokenInfo':
 *                               https://developers.circle.com/w3s/reference/listwalletballance
 *
 */
wallets.get('/:id/balances', (0, middleware_1.validate)(middleware_1.walletTokenBalanceSchema), controllers_1.getWalletTokenBalance);
/**
 * GET - /wallets/:id
 * Retrieves info for a single user-controlled wallet
 *
 * Params:
 *  id: string               - ID in url path for the specific wallet.
 *
 * Returns:
 *  wallet: walletObject     - wallet details.
 *                             Read more about 'walletObject':
 *                             https://developers.circle.com/w3s/reference/getwallet
 *
 */
wallets.get('/:id', (0, middleware_1.validate)(middleware_1.getWalletSchema), controllers_1.getWallet);
/**
 * POST - /wallets
 * Creates a user controlled wallet with given blockchain.
 *
 * Body:
 *  blockchain: Blockchain   - Blockchain network to create wallet on
 *
 * Returns:
 *  challengeId: string      - used to initiate a challenge flow for the user to create new wallet
 *
 */
wallets.post('/', (0, middleware_1.validate)(yup.object({
    body: yup
        .object({
        blockchain: yup.string().required()
    })
        .noUnknown(true)
        .strict()
})), controllers_1.createWallet);
