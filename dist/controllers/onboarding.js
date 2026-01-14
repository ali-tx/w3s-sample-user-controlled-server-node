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
exports.signIn = exports.signInCallback = exports.signUp = exports.signUpCallback = void 0;
const crypto_1 = require("crypto");
const services_1 = require("../services");
const circleService_1 = __importDefault(require("../services/external/circleService"));
const bcrypt_1 = require("bcrypt");
const logger_1 = require("../services/logging/logger");
async function pollContractStatus(circleContractId, id, userId, name, artifactPath, walletAddress) {
    const maxPolls = 300; // 2.5 hours if polling every 30s
    let polls = 0;
    const pollInterval = setInterval(async () => {
        try {
            const contractData = await circleService_1.default.getContract(circleContractId);
            if (contractData.status === 'COMPLETE') {
                clearInterval(pollInterval);
                // Update DB
                services_1.contractDAO.insertContract({
                    id,
                    userId,
                    name,
                    contractAddress: contractData.contractAddress || contractData.address,
                    artifactPath,
                    status: 'deployed',
                    walletAddress,
                    contractId: circleContractId
                });
            }
            else if (polls >= maxPolls) {
                clearInterval(pollInterval);
                // Update status to failed
                services_1.contractDAO.insertContract({
                    id,
                    userId,
                    name,
                    artifactPath,
                    status: 'failed',
                    walletAddress,
                    contractId: circleContractId
                });
            }
            polls++;
        }
        catch (err) {
            console.error('Polling error', err);
            clearInterval(pollInterval);
        }
    }, 30000);
}
const signUpCallback = (req, res) => async function (err, rows) {
    if (err) {
        throw err;
    }
    else if (rows.length > 0) {
        // user already signed up
        res.status(201).send({});
    }
    else {
        // user is new
        const newUserId = (0, crypto_1.randomUUID)();
        await services_1.circleUserSdk.createUser({
            userId: newUserId
        });
        const tokenResponse = await services_1.circleUserSdk.createUserToken({
            userId: newUserId
        });
        const challengeResponse = await services_1.circleUserSdk.createUserPinWithWallets({
            userId: newUserId,
            blockchains: ['ETH-SEPOLIA'],
            accountType: 'EOA'
        });
        // insert User into DB
        services_1.userDAO.insertUser(newUserId, req.body.email, await (0, bcrypt_1.hash)(req.body.password, 10));
        logger_1.logger.info(`New user inserted into DB, userId: ${newUserId}, email: ${req.body.email}`);
        res.status(200).send({
            userId: newUserId,
            userToken: tokenResponse.data?.userToken,
            encryptionKey: tokenResponse.data?.encryptionKey,
            challengeId: challengeResponse.data?.challengeId
        });
    }
};
exports.signUpCallback = signUpCallback;
const signUp = async (req, res, next) => {
    try {
        services_1.userDAO.getUserByEmail(req.body.email, (0, exports.signUpCallback)(req, res));
    }
    catch (error) {
        next(error);
    }
};
exports.signUp = signUp;
const signInCallback = (req, res) => async function (err, rows) {
    if (err) {
        throw err;
    }
    else if (rows.length > 0) {
        const user = rows[0];
        const passwordMatches = await (0, bcrypt_1.compare)(req.body.password, user.password);
        if (!passwordMatches) {
            // password invalid
            res.sendStatus(401);
            return;
        }
        // valid credentials
        const tokenResponse = await services_1.circleUserSdk.createUserToken({
            userId: user.userId
        });
        const userResponse = await services_1.circleUserSdk.getUser({
            userId: user.userId
        });
        let challengeResponse = undefined;
        if (userResponse.data?.user?.pinStatus !== 'ENABLED' ||
            userResponse.data?.user?.securityQuestionStatus !== 'ENABLED') {
            // when user has not enabled their PIN or security questions yet
            challengeResponse = await services_1.circleUserSdk.createUserPinWithWallets({
                userId: user.userId,
                blockchains: ['ETH-SEPOLIA'],
                accountType: 'EOA'
            });
        }
        // Create contract if pin enabled and no contract
        if (userResponse.data?.user?.pinStatus === 'ENABLED' &&
            userResponse.data?.user?.securityQuestionStatus === 'ENABLED') {
            try {
                const existingContracts = await services_1.contractDAO.getContractsByUser(user.userId);
                if (existingContracts.length === 0) {
                    if (tokenResponse.data?.userToken) {
                        const listResp = await services_1.circleUserSdk.listWallets({
                            userToken: tokenResponse.data.userToken
                        });
                        const latestWallet = listResp.data?.wallets?.[0];
                        if (latestWallet) {
                            const result = await (0, services_1.createContractForUser)(user.userId, `${user.userId}`, latestWallet.address, tokenResponse.data.userToken);
                            if (result.artifactPath) {
                                const cid = `${user.userId}-${Date.now()}`;
                                let status = 'compiled';
                                if (result.deployed && result.contractAddress) {
                                    status = 'deployed';
                                }
                                else if (result.circleContractId) {
                                    status = 'pending';
                                    // Start polling
                                    pollContractStatus(result.circleContractId, cid, user.userId, `${user.userId}`, result.artifactPath, latestWallet.address);
                                }
                                await services_1.contractDAO.insertContract({
                                    id: cid,
                                    userId: user.userId,
                                    name: `${user.userId}`,
                                    contractAddress: result.contractAddress || null,
                                    artifactPath: result.artifactPath,
                                    status,
                                    walletAddress: latestWallet.address,
                                    contractId: result.circleContractId || null
                                });
                                logger_1.logger.info(`Contract created for user ${user.userId}: ${result.contractAddress || 'compiled'}`);
                            }
                            else
                                logger_1.logger.warn(`Contract not created for user ${user.userId}`);
                        }
                    }
                }
            }
            catch (err) {
                logger_1.logger.error(`Failed to create contract for user ${user.userId}`, err);
            }
        }
        res.status(200).send({
            userId: user.userId,
            userToken: tokenResponse.data?.userToken,
            encryptionKey: tokenResponse.data?.encryptionKey,
            challengeId: challengeResponse?.data?.challengeId
        });
    }
    else {
        // invalid credentials or user does not exist
        res.sendStatus(404);
    }
};
exports.signInCallback = signInCallback;
const signIn = async (req, res, next) => {
    try {
        services_1.userDAO.getUserByEmail(req.body.email, (0, exports.signInCallback)(req, res));
    }
    catch (error) {
        next(error);
    }
};
exports.signIn = signIn;
