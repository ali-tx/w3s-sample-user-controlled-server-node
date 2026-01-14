"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployContract = deployContract;
exports.getContract = getContract;
exports.executeReceive = executeReceive;
exports.executeSplit = executeSplit;
const config_1 = __importDefault(require("../../config"));
const circleApiService_1 = require("./circleApiService");
const logger_1 = require("../../services/logging/logger");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { v4: uuidv4 } = require('uuid');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const forge = require('node-forge');
const CIRCLE_WALLET_ID = config_1.default.CIRCLE_WALLET_ID || '';
async function deployContract(bytecode, name, abi, userToken, description = 'Smart Contract') {
    try {
        let hexEncodedEntitySecret = '85667cbf389398b6a466be4e13ef7f265d4e923a9490956784c74f44769d2a02';
        if (userToken) {
            try {
                const payload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString());
                if (payload.entitySecret) {
                    hexEncodedEntitySecret = payload.entitySecret;
                }
            }
            catch (err) {
                logger_1.logger.warn('Failed to parse userToken for entitySecret', err);
            }
        }
        const publicKeyString = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA2IoGcUDaC5fMc2lr38vp
w3ZUqoPkoIWzhCeSBkBOi19eNAxIThBAvGO4QRUzocDImDMarHBzQbmgKPOh3CsG
4EssS4GkzSwXK+z+HajuYViFfv79yMNel4IMssYrKy2ReYNeOdBGkouEWc903MjS
XwLA/BudbOu25Y8ot4sXP7p43d1uOQjj8anVSBH7/d0BKPt/BgqMHxHRNCkROtGe
uWDVGPuS4OxM30WTjup43/y08UDT+AECmoIJPdzPpP6OErcRkOIxSrj4o5hLOCJh
THKeIQVcp9HnS3HvVgf5Q4kf4hPZNfh2B5qnZiH+0F0NNDO+fsMMYWMHxKXYEhbK
JfAwRn63foaMemevKC5ERJni6vQCc0EpXYPA68r8iNmZYOtJ98KRAevxjGNCZ/qY
j10AF88d7f+ua1xHDlxFeNn7zrdxTxVn/DmTpS7j4WFzPubC0ZJTdN38FTD7tOct
1AdzeUVTeXpPVM9HLs9NNT4K01BkHA6ruhuT9z4o3OrkNttzeWwbVZeUs+pvbyCt
gg9M0XrgD+tr70xCxFeSHul5cOaoXEnifIKhitTOEMD2CRMnBz20LynySJNPEBBC
fu3Wrh9RsFOCZM3LMiWmNYVch2nJjSTnfJm9FIgOXn8CCHwIMDYlXKHzwftdJQ34
nEtrj/cRJ+PhEyFbZRSWjo8CAwEAAQ==
-----END PUBLIC KEY-----`;
        const entitySecret = forge.util.hexToBytes(hexEncodedEntitySecret);
        const publicKey = forge.pki.publicKeyFromPem(publicKeyString);
        const encryptedData = publicKey.encrypt(entitySecret, 'RSA-OAEP', {
            md: forge.md.sha256.create(),
            mgf1: { md: forge.md.sha256.create() }
        });
        const entitySecretCiphertext = forge.util.encode64(encryptedData);
        const resp = await (0, circleApiService_1.post)('/v1/w3s/contracts/deploy', {
            idempotencyKey: uuidv4(),
            name,
            description,
            walletId: CIRCLE_WALLET_ID,
            blockchain: 'ETH-SEPOLIA',
            feeLevel: 'MEDIUM',
            entitySecretCiphertext,
            abiJSON: JSON.stringify(abi),
            bytecode: '0x' + bytecode
        });
        logger_1.logger.info('Deploy response:', resp.data);
        return resp.data;
    }
    catch (err) {
        logger_1.logger.error('circleService.deployContract failed', err);
        throw err;
    }
}
async function getContract(contractId) {
    try {
        const resp = await (0, circleApiService_1.get)(`/v1/w3s/contracts/${contractId}`);
        return resp.data.data?.contract || resp.data.contract;
    }
    catch (err) {
        logger_1.logger.error('getContract failed', err);
        throw err;
    }
}
async function executeReceive(amount, contractId) {
    try {
        logger_1.logger.info(`Circle webhook event: Executing receiveUSDC for ${amount} USDC on contract ${contractId}`);
        // Execute the receiveUSDC function on the contract via Circle API
        const resp = await (0, circleApiService_1.post)(`/v1/w3s/contracts/${contractId}/functions/receiveUSDC`, {
            idempotencyKey: uuidv4(),
            parameters: [
                {
                    type: 'uint256',
                    value: amount.toString()
                }
            ],
            feeLevel: 'MEDIUM'
        });
        logger_1.logger.info('Execute receive response:', resp.data);
        logger_1.logger.info(`Circle webhook event processed: USDCReceived event emitted for ${amount} USDC`);
        return resp.data;
    }
    catch (err) {
        logger_1.logger.error('executeReceive failed', err);
        throw err;
    }
}
async function executeSplit(amount, contractId) {
    try {
        // Execute the splitUSDC function on the contract via Circle API
        const resp = await (0, circleApiService_1.post)(`/v1/w3s/contracts/${contractId}/functions/splitUSDC`, {
            idempotencyKey: uuidv4(),
            parameters: [
                {
                    type: 'uint256',
                    value: amount.toString()
                }
            ],
            feeLevel: 'MEDIUM'
        });
        logger_1.logger.info('Execute split response:', resp.data);
        return resp.data;
    }
    catch (err) {
        logger_1.logger.error('executeSplit failed', err);
        throw err;
    }
}
exports.default = { deployContract, getContract, executeReceive, executeSplit };
