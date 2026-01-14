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
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const config = {
    PORT: process.env.PORT || process.env.SERVER_PORT || 8080,
    CIRCLE_API_KEY: process.env.CIRCLE_API_KEY || process.env.API_KEY || null,
    CIRCLE_WALLET_ID: process.env.CIRCLE_WALLET_ID || null,
    CIRCLE_API_BASE_URL: process.env.CIRCLE_API_BASE_URL || 'https://api.circle.com',
    INFURA_API_KEY: process.env.INFURA_API_KEY || process.env.INFURA || null,
    INFURA_RPC_URL: process.env.INFURA_RPC_URL ||
        (process.env.INFURA_API_KEY
            ? `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`
            : null),
    INFURA_WS_URL: process.env.INFURA_WS_URL ||
        (process.env.INFURA_API_KEY
            ? `wss://mainnet.infura.io/ws/v3/${process.env.INFURA_API_KEY}`
            : null),
    USDC_ADDRESS: process.env.USDC_ADDRESS || '0xA0b86a33E6441e88C5F2712C3E9b74B8F0fA5Cf9',
    PROCESS_HISTORICAL_TRANSFERS: (process.env.PROCESS_HISTORICAL_TRANSFERS || 'false') === 'true',
    START_USDC_WATCHER: (process.env.START_USDC_WATCHER || 'true') === 'true',
    CONTRACT_BUILDER_URL: process.env.CONTRACT_BUILDER_URL || null,
    FEE_WALLET: process.env.FEE_WALLET || null,
    DATABASE_FILENAME: process.env.DATABASE_FILENAME || ':memory:'
};
exports.default = config;
