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

import { UUID, randomUUID } from 'crypto';
import {
  circleUserSdk,
  userDAO,
  contractDAO,
  createContractForUser
} from '../services';
import circleService from '../services/external/circleService';
import { Request, Response, NextFunction } from 'express';
import { User } from '../middleware';
import { hash, compare } from 'bcrypt';
// @// import { CreateUserWithPinChallengeResponse } from '@circle-fin/user-controlled-wallets/dist/types/clients/user-controlled-wallets';
import { TrimDataResponse } from '@circle-fin/user-controlled-wallets/dist/types/clients/core';
import { logger } from '../services/logging/logger';

async function pollContractStatus(
  circleContractId: string,
  id: string,
  userId: string,
  name: string,
  artifactPath: string,
  walletAddress: string | null
) {
  const maxPolls = 300; // 2.5 hours if polling every 30s
  let polls = 0;
  const pollInterval = setInterval(async () => {
    try {
      const contractData = await circleService.getContract(circleContractId);
      if (contractData.status === 'COMPLETE') {
        clearInterval(pollInterval);
        // Update DB
        contractDAO.insertContract({
          id,
          userId,
          name,
          contractAddress: contractData.contractAddress || contractData.address,
          artifactPath,
          status: 'deployed',
          walletAddress,
          contractId: circleContractId
        });
      } else if (polls >= maxPolls) {
        clearInterval(pollInterval);
        // Update status to failed
        contractDAO.insertContract({
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
    } catch (err) {
      console.error('Polling error', err);
      clearInterval(pollInterval);
    }
  }, 30000);
}

export const signUpCallback = (req: Request, res: Response) =>
  async function (err: Error | null, rows: User[]) {
    if (err) {
      throw err;
    } else if (rows.length > 0) {
      // user already signed up
      res.status(201).send({});
    } else {
      // user is new
      const newUserId: UUID = randomUUID();
      await circleUserSdk.createUser({
        userId: newUserId
      });
      const tokenResponse = await circleUserSdk.createUserToken({
        userId: newUserId
      });
      const challengeResponse = await circleUserSdk.createUserPinWithWallets({
        userId: newUserId,
        blockchains: ['ETH-SEPOLIA'],
        accountType: 'EOA'
      });

      // insert User into DB
      userDAO.insertUser(
        newUserId,
        req.body.email,
        await hash(req.body.password, 10)
      );
      logger.info(
        `New user inserted into DB, userId: ${newUserId}, email: ${req.body.email}`
      );

      res.status(200).send({
        userId: newUserId,
        userToken: tokenResponse.data?.userToken,
        encryptionKey: tokenResponse.data?.encryptionKey,
        challengeId: challengeResponse.data?.challengeId
      });
    }
  };
export const signUp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    userDAO.getUserByEmail(req.body.email, signUpCallback(req, res));
  } catch (error: unknown) {
    next(error);
  }
};

export const signInCallback = (req: Request, res: Response) =>
  async function (err: Error | null, rows: User[]) {
    if (err) {
      throw err;
    } else if (rows.length > 0) {
      const user = rows[0];
      const passwordMatches = await compare(req.body.password, user.password);
      if (!passwordMatches) {
        // password invalid
        res.sendStatus(401);
        return;
      }

      // valid credentials
      const tokenResponse = await circleUserSdk.createUserToken({
        userId: user.userId
      });
      const userResponse = await circleUserSdk.getUser({
        userId: user.userId
      });
      let challengeResponse:
        | any
        | undefined = undefined;
      if (
        userResponse.data?.user?.pinStatus !== 'ENABLED' ||
        userResponse.data?.user?.securityQuestionStatus !== 'ENABLED'
      ) {
        // when user has not enabled their PIN or security questions yet
        challengeResponse = await circleUserSdk.createUserPinWithWallets({
          userId: user.userId,
          blockchains: ['ETH-SEPOLIA'],
          accountType: 'EOA'
        });
      }

      // Create contract if pin enabled and no contract
      if (
        userResponse.data?.user?.pinStatus === 'ENABLED' &&
        userResponse.data?.user?.securityQuestionStatus === 'ENABLED'
      ) {
        try {
          const existingContracts = await contractDAO.getContractsByUser(
            user.userId
          );
          if (existingContracts.length === 0) {
            if (tokenResponse.data?.userToken) {
              const listResp = await circleUserSdk.listWallets({
                userToken: tokenResponse.data.userToken
              });
              const latestWallet = listResp.data?.wallets?.[0];
              if (latestWallet) {
                const result = await createContractForUser(
                  user.userId,
                  `${user.userId}`,
                  latestWallet.address,
                  tokenResponse.data.userToken
                );
                if (result.artifactPath) {
                  const cid = `${user.userId}-${Date.now()}`;
                  let status = 'compiled';
                  if (result.deployed && result.contractAddress) {
                    status = 'deployed';
                  } else if (result.circleContractId) {
                    status = 'pending';
                    // Start polling
                    pollContractStatus(
                      result.circleContractId,
                      cid,
                      user.userId,
                      `${user.userId}`,
                      result.artifactPath!,
                      latestWallet.address
                    );
                  }
                  await contractDAO.insertContract({
                    id: cid,
                    userId: user.userId,
                    name: `${user.userId}`,
                    contractAddress: result.contractAddress || null,
                    artifactPath: result.artifactPath,
                    status,
                    walletAddress: latestWallet.address,
                    contractId: result.circleContractId || null
                  });
                  logger.info(
                    `Contract created for user ${user.userId}: ${
                      result.contractAddress || 'compiled'
                    }`
                  );
                } else
                  logger.warn(`Contract not created for user ${user.userId}`);
              }
            }
          }
        } catch (err) {
          logger.error(
            `Failed to create contract for user ${user.userId}`,
            err
          );
        }
      }

      res.status(200).send({
        userId: user.userId,
        userToken: tokenResponse.data?.userToken,
        encryptionKey: tokenResponse.data?.encryptionKey,
        challengeId: challengeResponse?.data?.challengeId
      });
    } else {
      // invalid credentials or user does not exist
      res.sendStatus(404);
    }
  };

export const signIn = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    userDAO.getUserByEmail(req.body.email, signInCallback(req, res));
  } catch (error: unknown) {
    next(error);
  }
};
