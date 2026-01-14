"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-expect-error node-forge has no types
const node_forge_1 = __importDefault(require("node-forge"));
const axios_1 = __importDefault(require("axios"));
const hexEncodedEntitySecret = '85667cbf389398b6a466be4e13ef7f265d4e923a9490956784c74f44769d2a02';
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
class CircleService {
    constructor(config) {
        this.config = config;
    }
    encryptEntitySecret() {
        const entitySecret = node_forge_1.default.util.hexToBytes(hexEncodedEntitySecret);
        if (entitySecret.length !== 32)
            throw new Error('Invalid entity secret length');
        const publicKey = node_forge_1.default.pki.publicKeyFromPem(publicKeyString);
        const encryptedData = publicKey.encrypt(entitySecret, 'RSA-OAEP', {
            md: node_forge_1.default.md.sha256.create(),
            mgf1: { md: node_forge_1.default.md.sha256.create() }
        });
        return node_forge_1.default.util.encode64(encryptedData);
    }
    async executeReceive(amount, contractAddress) {
        const { v4: uuidv4 } = await Promise.resolve().then(() => __importStar(require('uuid')));
        try {
            const ciphertext = this.encryptEntitySecret();
            const payload = {
                idempotencyKey: uuidv4(),
                walletId: this.config.circleWalletId,
                contractAddress,
                abiFunctionSignature: 'receiveUSDC(uint256)',
                abiParameters: [amount.toString()],
                feeLevel: 'MEDIUM',
                entitySecretCiphertext: ciphertext
            };
            const response = await axios_1.default.post('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', payload, {
                headers: {
                    Authorization: `Bearer ${this.config.circleApiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });
            return { success: true, transactionId: response.data.data?.id, amount };
        }
        catch (error) {
            throw new Error(`Circle API failed: ${error.message}`);
        }
    }
    async executeSplit(amount, contractAddress) {
        const { v4: uuidv4 } = await Promise.resolve().then(() => __importStar(require('uuid')));
        try {
            const ciphertext = this.encryptEntitySecret();
            const payload = {
                idempotencyKey: uuidv4(),
                walletId: this.config.circleWalletId,
                contractAddress,
                abiFunctionSignature: 'splitUSDC(uint256)',
                abiParameters: [amount.toString()],
                feeLevel: 'MEDIUM',
                entitySecretCiphertext: ciphertext
            };
            const response = await axios_1.default.post('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', payload, {
                headers: {
                    Authorization: `Bearer ${this.config.circleApiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });
            return { success: true, transactionId: response.data.data?.id, amount };
        }
        catch (error) {
            throw new Error(`Circle API failed: ${error.message}`);
        }
    }
    async fetchContractsFromTransactions() {
        return [];
    }
}
exports.default = CircleService;
