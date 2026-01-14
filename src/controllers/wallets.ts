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

import { Blockchain } from '@circle-fin/user-controlled-wallets';
import { circleUserSdk, contractDAO, createContractForUser } from '../services';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logging/logger';

export const getWalletTokenBalance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const response = await circleUserSdk.getWalletTokenBalance({
      userToken: req.headers['token'] as string,
      walletId: req.params.id,
      // Yup validation in the middleware allows the spread of the req.query valid.
      ...req.query
    });
    res.status(200).send(response.data);
  } catch (error: unknown) {
    next(error);
  }
};

export const listWallets = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const response = await circleUserSdk.listWallets({
      userToken: req.headers['token'] as string,
      // Yup validation in the middleware allows the spread of the req.query valid.
      ...req.query
    });

    // Get userId from token
    const userToken = req.headers['token'] as string;
    const payload = JSON.parse(
      Buffer.from(userToken.split('.')[1], 'base64').toString()
    );
    const userId = payload.sub || payload.user_id || payload.userId;

    if (userId && response.data?.wallets) {
      try {
        const contracts = await contractDAO.getContractsByUser(userId);
        // Add contractAddress to each wallet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response.data.wallets = response.data.wallets.map((wallet: any) => {
          const matchingContract = contracts.find(
            (c) => c.walletAddress === wallet.address
          );
          return {
            ...wallet,
            contractAddress: matchingContract?.contractAddress || null
          };
        });
      } catch (err) {
        logger.warn('Failed to fetch contracts for user', err);
      }
    }

    res.status(200).send(response.data);
  } catch (error: unknown) {
    next(error);
  }
};

export const getWallet = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const response = await circleUserSdk.getWallet({
      userToken: req.headers['token'] as string,
      id: req.params.id
    });

    // Get userId from token
    const userToken = req.headers['token'] as string;
    const payload = JSON.parse(
      Buffer.from(userToken.split('.')[1], 'base64').toString()
    );
    const userId = payload.sub || payload.user_id || payload.userId;

    let contractAddress: string | null = null;
    if (userId && response.data?.wallet) {
      try {
        const contracts = await contractDAO.getContractsByUser(userId);
        // Find the contract where walletAddress matches the wallet address
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matchingContract = contracts.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (c) => c.walletAddress === (response.data as any).wallet.address
        );
        contractAddress = matchingContract?.contractAddress || null;
      } catch (err) {
        logger.warn('Failed to fetch contracts for user', err);
      }
    }

    if (response.data?.wallet) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (response.data as any).wallet.contractAddress = contractAddress;
    }

    res.status(200).send(response.data);
  } catch (error: unknown) {
    next(error);
  }
};

export const createWallet = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const response = await circleUserSdk.createWallet({
      blockchains: [req.body.blockchain as Blockchain],
      userToken: req.headers['token'] as string
    });

    logger.info('Create wallet response data:', response.data);

    // Deploy contract for the new wallet
    const userToken = req.headers['token'] as string;
    const payload = JSON.parse(
      Buffer.from(userToken.split('.')[1], 'base64').toString()
    );
    const userId = payload.sub || payload.user_id || payload.userId;
    if (userId) {
      // Get the latest wallet (the newly created one)
      const listResp = await circleUserSdk.listWallets({
        userToken
      });
      const latestWallet = listResp.data?.wallets?.[0];
      if (latestWallet) {
        createContractForUser(
          userId,
          `${userId}`,
          latestWallet.address,
          userToken
        )
          .then(async (result) => {
            if (result.deployed && result.contractAddress) {
              logger.info(
                `Deployed contract for user ${userId}: ${result.contractAddress}`
              );
              const cid = `${userId}-${Date.now()}`;
              await contractDAO.insertContract({
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
          .catch((err) =>
            logger.error(`Contract deploy failed for user ${userId}`, err)
          );
      }
    }

    res.status(200).send(response.data?.challengeId);
  } catch (error: unknown) {
    next(error);
  }
};
