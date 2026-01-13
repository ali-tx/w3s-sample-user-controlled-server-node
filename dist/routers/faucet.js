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
exports.faucet = void 0;
const express_1 = __importDefault(require("express"));
const middleware_1 = require("../middleware");
const controllers_1 = require("../controllers");
const faucet = express_1.default.Router();
exports.faucet = faucet;
/**
 * POST - /faucet/drips
 * Request testnet tokens to specified wallet.
 *
 * Params:
 *  address: string         - Wallet address
 *  blockchain: string      - Specified blockchain
 *
 * Returns: null
 *
 */
faucet.post('/drips', (0, middleware_1.validate)(middleware_1.postFaucetDripSchema), controllers_1.dripFaucet);
