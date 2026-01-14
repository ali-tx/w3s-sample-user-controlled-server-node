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
Object.defineProperty(exports, "__esModule", { value: true });
exports.dripFaucet = void 0;
const services_1 = require("../services");
const dripFaucet = async (req, res, next) => {
    try {
        await services_1.circleUserSdk.requestTestnetTokens({
            address: req.body.address,
            blockchain: req.body.blockchain,
            usdc: true,
            native: req.body.blockchain === 'AVAX-FUJI'
        });
        res.status(200).send();
    }
    catch (error) {
        next(error);
    }
};
exports.dripFaucet = dripFaucet;
