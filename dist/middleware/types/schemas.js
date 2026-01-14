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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.postFaucetDripSchema = exports.getTokenDetailsSchema = exports.estimateTransferTokensSchema = exports.getTransactionSchema = exports.validateAddressSchema = exports.transferTokensSchema = exports.listTransactionsSchema = exports.getWalletSchema = exports.listWalletsSchema = exports.walletTokenBalanceSchema = exports.authenticationSchema = exports.initializeUserSchema = exports.getUserSchema = exports.createUserTokenSchema = void 0;
const yup = __importStar(require("yup"));
// User
exports.createUserTokenSchema = yup.object({
    body: yup
        .object({
        userId: yup.string().required()
    })
        .noUnknown(true)
        .strict()
});
exports.getUserSchema = yup.object({
    params: yup
        .object({
        id: yup.string().required()
    })
        .noUnknown(true)
        .strict()
});
exports.initializeUserSchema = yup.object({
    body: yup
        .object({
        userId: yup.string().required(),
        blockchain: yup.array().of(yup.string().required()).optional(),
        accountType: yup.string().optional()
    })
        .noUnknown(true)
        .strict()
});
// Onboarding
exports.authenticationSchema = yup.object({
    body: yup
        .object({
        email: yup.string().required(),
        password: yup.string().required(),
        name: yup.string().optional(),
        receiverWalletAddress: yup.string().optional(),
        feeWalletAddress: yup.string().optional()
    })
        .noUnknown(true)
        .strict()
});
// Wallets
exports.walletTokenBalanceSchema = yup.object({
    params: yup
        .object({
        id: yup.string().required()
    })
        .noUnknown(true)
        .strict(),
    query: yup
        .object({
        userId: yup.string().optional(),
        includeAll: yup.bool().optional(),
        name: yup.string().optional(),
        tokenAddresses: yup.array().of(yup.string().required()).optional(),
        standard: yup.string().optional(),
        from: yup.date().optional(),
        to: yup.date().optional(),
        pageBefore: yup.string().optional(),
        pageAfter: yup.string().optional(),
        pageSize: yup.number().optional()
    })
        .noUnknown(true)
        .strict()
});
exports.listWalletsSchema = yup.object({
    query: yup
        .object({
        userId: yup.string().optional(),
        address: yup.string().optional(),
        blockchain: yup.string().optional(),
        walletSetId: yup.string().optional(),
        refId: yup.string().optional(),
        from: yup.date().optional(),
        to: yup.date().optional(),
        pageBefore: yup.string().optional(),
        pageAfter: yup.string().optional(),
        pageSize: yup.number().optional()
    })
        .noUnknown(true)
        .strict()
});
exports.getWalletSchema = yup.object({
    params: yup.object({
        id: yup.string().required()
    })
});
// Transactions
exports.listTransactionsSchema = yup.object({
    query: yup
        .object({
        userId: yup.string().optional(),
        blockchain: yup.string().optional(),
        custodyType: yup.string().optional(),
        destinationAddress: yup.string().optional(),
        includeAll: yup.boolean().optional(),
        operation: yup.string().optional(),
        state: yup.string().optional(),
        txHash: yup.string().optional(),
        txType: yup.string().optional(),
        walletIds: yup.array().of(yup.string().required()).optional(),
        from: yup.date().optional(),
        to: yup.date().optional(),
        pageBefore: yup.string().optional(),
        pageAfter: yup.string().optional(),
        pageSize: yup.number().optional()
    })
        .noUnknown(true)
        .strict()
});
exports.transferTokensSchema = yup.object({
    body: yup
        .object({
        idempotencyKey: yup.string().optional(),
        amounts: yup.array().of(yup.string().required()).optional(),
        destinationAddress: yup.string().required(),
        feeLevel: yup.string().optional(),
        gasLimit: yup.string().optional(),
        gasPrice: yup.string().optional(),
        maxFee: yup.string().optional(),
        priorityFee: yup.string().optional(),
        nftTokenIds: yup.array().of(yup.string().required()).optional(),
        refId: yup.string().optional(),
        tokenId: yup.string().required(),
        walletId: yup.string().required()
    })
        .noUnknown(true)
        .strict()
});
exports.validateAddressSchema = yup.object({
    body: yup
        .object({
        address: yup.string().required(),
        blockchain: yup.string().required()
    })
        .noUnknown(true)
        .strict()
});
exports.getTransactionSchema = yup.object({
    params: yup
        .object({
        id: yup.string().required()
    })
        .noUnknown(true)
        .strict(),
    query: yup
        .object({
        txType: yup.string().optional()
    })
        .noUnknown(true)
        .strict()
});
exports.estimateTransferTokensSchema = yup.object({
    body: yup
        .object({
        amount: yup.array().of(yup.string().required()).required(),
        destinationAddress: yup.string().required(),
        nftTokenIds: yup.array().of(yup.string().required()).optional(),
        sourceAddress: yup.string().optional(),
        tokenId: yup.string().required(),
        walletId: yup.string().optional()
    })
        .noUnknown(true)
        .strict()
});
// Tokens
exports.getTokenDetailsSchema = yup.object({
    params: yup
        .object({
        id: yup.string().required()
    })
        .noUnknown(true)
        .strict()
});
// Faucet
exports.postFaucetDripSchema = yup.object({
    body: yup
        .object({
        address: yup.string().required(),
        blockchain: yup.string().required()
    })
        .noUnknown(true)
        .strict()
});
