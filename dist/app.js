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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const controllers_1 = require("./controllers");
const middleware_1 = require("./middleware");
const routers_1 = require("./routers");
const usdc_routes_1 = __importDefault(require("./routes/usdc.routes"));
const contract_routes_1 = __importDefault(require("./routes/contract.routes"));
const contracts_1 = require("./routers/contracts");
exports.app = (0, express_1.default)();
exports.app.use((0, cors_1.default)());
exports.app.use(express_1.default.json());
exports.app.get('/', (_req, res) => {
    res.send('Sample Server');
});
/**
 * Health check endpoint.
 */
exports.app.get('/api/ping', (_req, res) => {
    res.status(200).send('pong');
});
/**
 * POST - /api/signup
 * Convenience endpoint to creates user, userToken, encryptionKey, and challengeId to
 * setup PIN and wallet
 *
 *
 * Returns:
 *  userId: UUID          - the UUID of the newly created user
 *  userToken: string     - unique system generated JWT session token.
 *                          The token will expire after 60 minutes. Passed in through header.
 *  encryptionKey: string - encryption key to use to execute challengeIds
 *  challengeId: string   - used to initiate a challenge flow to setup PIN + Wallet
 */
exports.app.post('/api/signup', (0, middleware_1.validate)(middleware_1.authenticationSchema), controllers_1.signUp);
/**
 * POST - /signIn
 * Endpoint to authenticate email + password. If authenticated, return a new session of
 * userId, userToken, encryptionKey
 *
 * Params:
 *  email: string - the email of user
 *  password: string - password of user
 *
 * Returns:
 *  userId: UUID          - the UUID of the signed in user
 *  userToken: string     - unique system generated JWT session token.
 *                          The token will expire after 60 minutes. Passed in through header.
 *  encryptionKey: string - encryption key to use to execute challengeIds
 *
 * If user credentials wrong or don't exist:
 *  returns 404
 */
exports.app.post('/api/signin', (0, middleware_1.validate)(middleware_1.authenticationSchema), controllers_1.signIn);
/*
 * Add all sub paths
 */
exports.app.use('/api/users', routers_1.users, routers_1.authUserRouter);
exports.app.use('/api/tokens', routers_1.tokens);
exports.app.use('/api/wallets', middleware_1.authMiddleware, routers_1.wallets);
exports.app.use('/api/transactions', routers_1.transactions, routers_1.authTransRouter);
exports.app.use('/api/faucet', middleware_1.authMiddleware, routers_1.faucet);
exports.app.use('/api/contracts', contracts_1.contractsRouter);
exports.app.use('/api/usdc', usdc_routes_1.default);
exports.app.use('/api/contract', middleware_1.authMiddleware, contract_routes_1.default);
// Error handling
exports.app.use(middleware_1.errorHandler);
