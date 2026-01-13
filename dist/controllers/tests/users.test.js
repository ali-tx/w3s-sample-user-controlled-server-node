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
const users_1 = require("../users");
const express_1 = require("@jest-mock/express");
jest.mock('../../services', () => ({
    circleUserSdk: {
        createUser: jest
            .fn()
            // first mock value
            .mockResolvedValueOnce({})
            // second mock value
            .mockRejectedValueOnce(new Error('Invalid Input')),
        createUserToken: jest
            .fn()
            // first mock value
            .mockResolvedValueOnce({
            data: {
                userToken: 'mockUserToken',
                encryptionKey: 'mockEncryptionKey'
            }
        })
            // second mock value
            .mockRejectedValueOnce(new Error('Invalid Input')),
        createUserPinWithWallets: jest
            .fn()
            // first mock value
            .mockResolvedValueOnce({
            data: {
                challengeId: 'mockChallengeId'
            }
        })
            // second mock value
            .mockRejectedValueOnce(new Error('Invalid Input'))
    },
    db: {
        schema: {
            hasTable: jest.fn(() => Promise.resolve()),
            createTable: jest.fn(() => Promise.resolve())
        },
        where: jest.fn(() => Promise.resolve()),
        insert: jest.fn(() => Promise.resolve())
    }
}));
describe('createUser', () => {
    test('Should return 200 on successful', async () => {
        const req = (0, express_1.getMockReq)({
            body: {}
        });
        const { res, next } = (0, express_1.getMockRes)();
        await (0, users_1.createUser)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(200);
    });
    test('Should return 400 on error', async () => {
        const req = (0, express_1.getMockReq)({
            body: {}
        });
        const { res, next } = (0, express_1.getMockRes)();
        await (0, users_1.createUser)(req, res, next);
        expect(next).toHaveBeenCalledWith(new Error('Invalid Input'));
    });
});
const mockTokenReturnValue = {
    data: {
        userToken: 'mockUserToken',
        encryptionKey: 'mockEncryptionKey'
    }
};
describe('createUserToken', () => {
    test('Should return 200 on successful', async () => {
        const req = (0, express_1.getMockReq)({
            body: {
                userId: 'mockUserId'
            }
        });
        const { res, next } = (0, express_1.getMockRes)();
        await (0, users_1.createUserToken)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith(mockTokenReturnValue.data);
    });
    test('Should return 400 on error', async () => {
        const req = (0, express_1.getMockReq)({
            body: {
                userId: 'mockUserId'
            }
        });
        const { res, next } = (0, express_1.getMockRes)();
        await (0, users_1.createUserToken)(req, res, next);
        expect(next).toHaveBeenCalledWith(new Error('Invalid Input'));
    });
});
const mockInitializeReturnValue = {
    data: {
        challengeId: 'mockChallengeId'
    }
};
describe('initializeUser', () => {
    test('Should return 200 on successful', async () => {
        const req = (0, express_1.getMockReq)({
            body: {
                userId: 'mockId',
                blockchains: ['ETH-SEPOLIA'],
                accountType: 'EOA'
            }
        });
        const { res, next } = (0, express_1.getMockRes)();
        await (0, users_1.initializeUser)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith(mockInitializeReturnValue.data);
    });
    test('Should return 400 on error', async () => {
        const req = (0, express_1.getMockReq)({
            body: {
                userId: 'mockId',
                blockchains: ['ETH-SEPOLIA'],
                accountType: 'EOA'
            }
        });
        const { res, next } = (0, express_1.getMockRes)();
        await (0, users_1.initializeUser)(req, res, next);
        expect(next).toHaveBeenCalledWith(new Error('Invalid Input'));
    });
});
