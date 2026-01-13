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
exports.createWallet = exports.getWallet = exports.listWallets = exports.getWalletTokenBalance = void 0;
const services_1 = require("../services");
const logger_1 = require("../services/logging/logger");
const getWalletTokenBalance = async (req, res, next) => {
    try {
        const response = await services_1.circleUserSdk.getWalletTokenBalance({
            userToken: req.headers['token'],
            walletId: req.params.id,
            // Yup validation in the middleware allows the spread of the req.query valid.
            ...req.query
        });
        res.status(200).send(response.data);
    }
    catch (error) {
        next(error);
    }
};
exports.getWalletTokenBalance = getWalletTokenBalance;
const listWallets = async (req, res, next) => {
    try {
        const response = await services_1.circleUserSdk.listWallets({
            userToken: req.headers['token'],
            // Yup validation in the middleware allows the spread of the req.query valid.
            ...req.query
        });
        // Get userId from token
        const userToken = req.headers['token'];
        const payload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString());
        const userId = payload.sub || payload.user_id || payload.userId;
        if (userId && response.data?.wallets) {
            try {
                const contracts = await services_1.contractDAO.getContractsByUser(userId);
                // Add contractAddress to each wallet
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                response.data.wallets = response.data.wallets.map((wallet) => {
                    const matchingContract = contracts.find((c) => c.walletAddress === wallet.address);
                    return {
                        ...wallet,
                        contractAddress: matchingContract?.contractAddress || null
                    };
                });
            }
            catch (err) {
                logger_1.logger.warn('Failed to fetch contracts for user', err);
            }
        }
        res.status(200).send(response.data);
    }
    catch (error) {
        next(error);
    }
};
exports.listWallets = listWallets;
const getWallet = async (req, res, next) => {
    try {
        const response = await services_1.circleUserSdk.getWallet({
            userToken: req.headers['token'],
            id: req.params.id
        });
        // Get userId from token
        const userToken = req.headers['token'];
        const payload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString());
        const userId = payload.sub || payload.user_id || payload.userId;
        let contractAddress = null;
        if (userId && response.data?.wallet) {
            try {
                const contracts = await services_1.contractDAO.getContractsByUser(userId);
                // Find the contract where walletAddress matches the wallet address
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const matchingContract = contracts.find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (c) => c.walletAddress === response.data.wallet.address);
                contractAddress = matchingContract?.contractAddress || null;
            }
            catch (err) {
                logger_1.logger.warn('Failed to fetch contracts for user', err);
            }
        }
        if (response.data?.wallet) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            response.data.wallet.contractAddress = contractAddress;
        }
        res.status(200).send(response.data);
    }
    catch (error) {
        next(error);
    }
};
exports.getWallet = getWallet;
const createWallet = async (req, res, next) => {
    try {
        const response = await services_1.circleUserSdk.createWallet({
            blockchains: [req.body.blockchain],
            userToken: req.headers['token']
        });
        logger_1.logger.info('Create wallet response data:', response.data);
        // Deploy contract for the new wallet
        const userToken = req.headers['token'];
        const payload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString());
        const userId = payload.sub || payload.user_id || payload.userId;
        if (userId) {
            // Get the latest wallet (the newly created one)
            const listResp = await services_1.circleUserSdk.listWallets({
                userToken
            });
            const latestWallet = listResp.data?.wallets?.[0];
            if (latestWallet) {
                (0, services_1.createContractForUser)(userId, `${userId}`, latestWallet.address, userToken)
                    .then(async (result) => {
                    if (result.deployed && result.contractAddress) {
                        logger_1.logger.info(`Deployed contract for user ${userId}: ${result.contractAddress}`);
                        const cid = `${userId}-${Date.now()}`;
                        await services_1.contractDAO.insertContract({
                            id: cid,
                            contractId: cid,
                            userId,
                            name: `${userId}`,
                            contractAddress: result.contractAddress,
                            artifactPath: result.artifactPath,
                            status: 'deployed'
                        });
                    }
                })
                    .catch((err) => logger_1.logger.error(`Contract deploy failed for user ${userId}`, err));
            }
        }
        res.status(200).send(response.data?.challengeId);
    }
    catch (error) {
        next(error);
    }
};
exports.createWallet = createWallet;
