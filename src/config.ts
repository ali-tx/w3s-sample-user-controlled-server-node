import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const config = {
  PORT: process.env.PORT || process.env.SERVER_PORT || 8080,
  CIRCLE_API_KEY: process.env.CIRCLE_API_KEY || process.env.API_KEY || null,
  CIRCLE_WALLET_ID: process.env.CIRCLE_WALLET_ID || null,
  CIRCLE_API_BASE_URL:
    process.env.CIRCLE_API_BASE_URL || 'https://api.circle.com',
  INFURA_API_KEY: process.env.INFURA_API_KEY || process.env.INFURA || null,
  INFURA_RPC_URL:
    process.env.INFURA_RPC_URL ||
    (process.env.INFURA_API_KEY
      ? `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`
      : null),
  INFURA_WS_URL:
    process.env.INFURA_WS_URL ||
    (process.env.INFURA_API_KEY
      ? `wss://mainnet.infura.io/ws/v3/${process.env.INFURA_API_KEY}`
      : null),
  USDC_ADDRESS:
    process.env.USDC_ADDRESS || '0xA0b86a33E6441e88C5F2712C3E9b74B8F0fA5Cf9',
  PROCESS_HISTORICAL_TRANSFERS:
    (process.env.PROCESS_HISTORICAL_TRANSFERS || 'false') === 'true',
  START_USDC_WATCHER: (process.env.START_USDC_WATCHER || 'true') === 'true',
  CONTRACT_BUILDER_URL: process.env.CONTRACT_BUILDER_URL || null,
  FEE_WALLET: process.env.FEE_WALLET || null,
  DATABASE_FILENAME: process.env.DATABASE_FILENAME || ':memory:'
};

export default config;
