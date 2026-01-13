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
exports.restorePin = exports.getUser = exports.initializeUser = exports.createUserToken = exports.createUser = void 0;
const crypto_1 = require("crypto");
const services_1 = require("../services");
/* Users circle sdk calls */
const createUser = async (_req, res, next) => {
    try {
        const newUserId = (0, crypto_1.randomUUID)();
        await services_1.circleUserSdk.createUser({
            userId: newUserId
        });
        res.status(200).send({ userId: newUserId });
    }
    catch (error) {
        next(error);
    }
};
exports.createUser = createUser;
const createUserToken = async (req, res, next) => {
    try {
        const response = await services_1.circleUserSdk.createUserToken({
            userId: req.body.userId
        });
        res.status(200).send(response.data);
    }
    catch (error) {
        next(error);
    }
};
exports.createUserToken = createUserToken;
const initializeUser = async (req, res, next) => {
    try {
        const response = await services_1.circleUserSdk.createUserPinWithWallets({
            userId: req.body.userId,
            blockchains: req.body?.blockchains ?? ['ETH-SEPOLIA'],
            accountType: req.body?.accountType
        });
        res.status(200).send(response.data);
    }
    catch (error) {
        next(error);
    }
};
exports.initializeUser = initializeUser;
const getUser = async (req, res, next) => {
    try {
        const response = await services_1.circleUserSdk.getUser({
            userId: req.params.id
        });
        res.status(200).send(response.data);
    }
    catch (error) {
        next(error);
    }
};
exports.getUser = getUser;
const restorePin = async (req, res, next) => {
    try {
        const response = await services_1.circleUserSdk.restoreUserPin({
            userToken: req.headers['token']
        });
        res.status(200).send(response.data);
    }
    catch (error) {
        next(error);
    }
};
exports.restorePin = restorePin;
