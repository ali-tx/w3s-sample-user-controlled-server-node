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
exports.circleUserSdk = void 0;
const user_controlled_wallets_1 = require("@circle-fin/user-controlled-wallets");
const config_1 = __importDefault(require("../config"));
const circleApiBaseUrl = config_1.default.CIRCLE_API_BASE_URL || 'https://api.circle.com';
exports.circleUserSdk = (0, user_controlled_wallets_1.initiateUserControlledWalletsClient)({
    apiKey: config_1.default.CIRCLE_API_KEY || '',
    baseUrl: circleApiBaseUrl,
    userAgent: 'PW-USER-WALLET-WEB-SAMPLE-APP'
});
