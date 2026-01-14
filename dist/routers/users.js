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
exports.authUserRouter = exports.users = void 0;
const express_1 = __importDefault(require("express"));
const controllers_1 = require("../controllers");
const middleware_1 = require("../middleware");
const users = express_1.default.Router();
exports.users = users;
const authUserRouter = express_1.default.Router();
exports.authUserRouter = authUserRouter;
authUserRouter.use(middleware_1.authMiddleware);
/**
 * POST - /users
 * Creates a user
 *
 * Returns:
 *  userId: UUID - the UUID of the newly created user
 */
users.post('/', controllers_1.createUser);
/**
 * GET - /users/:id
 * Gets the user object
 *
 * Params:
 *  id: string - the userId to retrieve
 *
 * Returns:
 *  - user object - Reference https://developers.circle.com/w3s/reference/getuser
 */
users.get('/:id', (0, middleware_1.validate)(middleware_1.getUserSchema), controllers_1.getUser);
/**
 * POST - /users/token
 * Creates a user token and encryption key
 *
 * Params:
 *  userId: string - the userId to create userToken and encryptionKey for
 *
 * Returns:
 *  userToken: string     - unique system generated JWT session token.
 *                          The token will expire after 60 minutes.
 *  encryptionKey: string - encryption key to use to execute challengeIds
 */
users.post('/token', (0, middleware_1.validate)(middleware_1.createUserTokenSchema), controllers_1.createUserToken);
/**
 * POST - /users/initialize
 * Creates a PIN setup and optionally, a new Wallet
 *
 * Params:
 *  userId: string        - the userId to create PIN for
 *  blockchains: [string] - the blockchains to create wallet on
 *  accountType: string   - accountType of the Wallet
 *                        - will default to "EOA" if not provided
 *
 * Returns:
 *  challengeId: string - used to initiate a challenge flow
 */
users.post('/initialize', (0, middleware_1.validate)(middleware_1.initializeUserSchema), controllers_1.initializeUser);
/**
 * POST - /users/pin/restore
 * Restore PIN flow
 *
 * Returns:
 *  challengeId: string - used to initiate a challenge flow for PIN restoration
 */
authUserRouter.post('/pin/restore', controllers_1.restorePin);
