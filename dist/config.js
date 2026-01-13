"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '..', '.env') });
const config = {
    PORT: process.env.PORT || process.env.SERVER_PORT || 8080,
    CIRCLE_API_KEY: process.env.CIRCLE_API_KEY || process.env.API_KEY || null,
    CIRCLE_WALLET_ID: process.env.CIRCLE_WALLET_ID || null,
    CIRCLE_API_BASE_URL: process.env.CIRCLE_API_BASE_URL || 'https://api.circle.com',
    INFURA_API_KEY: process.env.INFURA_API_KEY || process.env.INFURA || null,
    INFURA_RPC_URL: process.env.INFURA_RPC_URL ||
        (process.env.INFURA_API_KEY
            ? `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
            : null),
    USDC_ADDRESS: process.env.USDC_ADDRESS || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    PROCESS_HISTORICAL_TRANSFERS: (process.env.PROCESS_HISTORICAL_TRANSFERS || 'false') === 'true',
    START_USDC_WATCHER: (process.env.START_USDC_WATCHER || 'true') === 'true',
    CONTRACT_BUILDER_URL: process.env.CONTRACT_BUILDER_URL || null,
    FEE_WALLET: process.env.FEE_WALLET || null,
    DATABASE_FILENAME: process.env.DATABASE_FILENAME || ':memory:'
};
exports.default = config;
