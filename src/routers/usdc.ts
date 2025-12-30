import express, { Request, Response } from 'express';
import USDCWatcher from '../services/usdcWatcher';
import CircleService from '../services/circleService';
import CircleApiService from '../services/circleApiService';
import axios, { AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import forge from 'node-forge';
import ContractCompiler from '../services/contractCompiler';
import Web3 from 'web3';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

interface MonitoringConfig {
  rpcUrl: string;
  wsUrl: string;
  contractAddresses: string[];
  usdcAddress: string;
  circleApiKey: string;
  circleWalletId: string;
  processHistoricalTransfers: boolean;
}

interface StatusResponse {
  status: string;
  monitoring: string;
  connection: string;
  historicalProcessing: string;
  catchupChecks: string;
}

interface HistoricalCheckResponse {
  status: string;
  message: string;
  contractsChecked: number;
  eventsDetected?: number;
  splitsExecuted?: number;
  blocksProcessed?: number;
  error?: string;
}

interface ContractCheckResponse {
  contractAddress: string;
  blocksChecked: string;
  eventsFound: number;
  transfers: TransferResult[];
  error?: string;
}

interface TransferResult {
  transactionHash: string;
  blockNumber: number;
  from: string;
  to: string;
  amount: number;
  contractBalance: number;
  processed: boolean;
}

interface TransferCheckResponse {
  status: string;
  message: string;
  contractsChecked: number;
  eventsDetected?: number;
  splitsExecuted?: number;
  error?: string;
}

interface DeploySplitterBody {
  receiveWallet: string;
  feeWallet: string;
  name?: string;
}

interface CompileResult {
  abi: any[];
  bytecode: string;
  [key: string]: any;
}

interface CircleDeployResponse {
  success: boolean;
  message: string;
  data?: {
    transactionId?: string;
    status?: string;
    contractAddress?: string;
    abi?: any[];
    bytecode?: string;
    name?: string;
  };
  error?: string;
}

// Status endpoint
router.get('/status', (req: Request, res: Response): void => {
  const response: StatusResponse = {
    status: 'active',
    monitoring: 'USDC transfers to deployed contracts',
    connection: 'WebSocket (real-time) or polling (2s fallback)',
    historicalProcessing: '7 days lookback on startup',
    catchupChecks: 'every 2 seconds'
  };
  res.json(response);
});

// Manual historical check endpoint
router.post(
  '/check-historical',
  async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('🔍 Manual historical transfer check requested');

      // Create a temporary watcher instance for historical checking
      const monitoringConfig: MonitoringConfig = {
        rpcUrl: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
        wsUrl: `wss://sepolia.infura.io/ws/v3/${process.env.INFURA_API_KEY}`,
        contractAddresses: [], // Will be loaded from storage
        usdcAddress: process.env.USDC_ADDRESS || '',
        circleApiKey: process.env.CIRCLE_API_KEY || '',
        circleWalletId: process.env.CIRCLE_WALLET_ID || '',
        processHistoricalTransfers: true // Force historical processing
      };

      // Load contracts from storage
      monitoringConfig.contractAddresses =
        await CircleApiService.loadContractsFromStorage();

      if (monitoringConfig.contractAddresses.length === 0) {
        const response: HistoricalCheckResponse = {
          error: 'No contracts available for monitoring'
        };
        res.status(400).json(response);
        return;
      }

      const circleService = new CircleService(monitoringConfig);
      const tempWatcher = new USDCWatcher(monitoringConfig, circleService);

      // Force historical processing for last 30 days
      const currentBlock = await tempWatcher.web3.eth.getBlockNumber();
      const blocksPerDay = Math.floor((24 * 60 * 60) / 12);
      tempWatcher.lastBlock = Math.max(0, currentBlock - blocksPerDay * 30); // 30 days back

      console.log(
        `📊 Checking historical transfers from block ${tempWatcher.lastBlock} (last 30 days)`
      );
      await tempWatcher.checkForTransfers();

      const response: HistoricalCheckResponse = {
        status: 'checked',
        message: 'Historical transfer check completed (last 30 days)',
        contractsChecked: monitoringConfig.contractAddresses.length,
        eventsDetected: tempWatcher.eventsDetected,
        splitsExecuted: tempWatcher.splitsExecuted,
        blocksProcessed: currentBlock - tempWatcher.lastBlock
      };
      res.json(response);
    } catch (error: any) {
      const response: HistoricalCheckResponse = {
        error: error.message
      };
      res.status(500).json(response);
    }
  }
);

// Check specific contract endpoint
router.post(
  '/check-contract/:address',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const contractAddress = req.params.address.toLowerCase();
      console.log(`🔍 Checking specific contract: ${contractAddress}`);

      const web3 = new Web3(
        `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
      );

      // Get current block
      const currentBlock = await web3.eth.getBlockNumber();
      const pastBlock = currentBlock - 1000; // Check last 1000 blocks

      // USDC Contract
      const usdcABI = [
        {
          constant: true,
          inputs: [{ name: '_owner', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: 'balance', type: 'uint256' }],
          type: 'function'
        },
        {
          anonymous: false,
          inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { indexed: false, name: 'value', type: 'uint256' }
          ],
          name: 'Transfer',
          type: 'event'
        }
      ];
      const usdcContract = new web3.eth.Contract(
        usdcABI,
        process.env.USDC_ADDRESS || ''
      );

      console.log(
        `📊 Checking blocks ${pastBlock} to ${currentBlock} for transfers to ${contractAddress}`
      );

      // Get past events
      const events = await usdcContract.getPastEvents('Transfer', {
        filter: { to: contractAddress },
        fromBlock: pastBlock,
        toBlock: currentBlock
      });

      console.log(
        `📨 Found ${events.length} transfer events to ${contractAddress}`
      );

      const results: TransferResult[] = [];
      for (const event of events) {
        const { from, to, value } = event.returnValues;
        const amount = parseInt(value);
        const txHash = event.transactionHash;

        // Check contract balance at the time of transfer
        const balance = await usdcContract.methods
          .balanceOf(to)
          .call({}, event.blockNumber);

        results.push({
          transactionHash: txHash,
          blockNumber: event.blockNumber,
          from,
          to,
          amount: amount / 1000000, // Convert to USDC
          contractBalance: parseInt(balance) / 1000000,
          processed: amount >= 300000 // Would be processed if >= 0.3 USDC
        });
      }

      const response: ContractCheckResponse = {
        contractAddress,
        blocksChecked: `${pastBlock} to ${currentBlock}`,
        eventsFound: events.length,
        transfers: results
      };
      res.json(response);
    } catch (error: any) {
      console.error('Contract check error:', error);
      const response: ContractCheckResponse = {
        contractAddress: req.params.address,
        blocksChecked: 'N/A',
        eventsFound: 0,
        transfers: [],
        error: error.message
      };
      res.status(500).json(response);
    }
  }
);

// Manual transfer check endpoint
router.post(
  '/check-transfers',
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Create a temporary watcher instance for manual checking
      const monitoringConfig: MonitoringConfig = {
        rpcUrl: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
        wsUrl: `wss://sepolia.infura.io/ws/v3/${process.env.INFURA_API_KEY}`,
        contractAddresses: [], // Will be loaded from storage
        usdcAddress: process.env.USDC_ADDRESS || '',
        circleApiKey: process.env.CIRCLE_API_KEY || '',
        circleWalletId: process.env.CIRCLE_WALLET_ID || '',
        processHistoricalTransfers:
          process.env.PROCESS_HISTORICAL_TRANSFERS === 'true'
      };

      // Load contracts from storage
      monitoringConfig.contractAddresses =
        await CircleApiService.loadContractsFromStorage();

      if (monitoringConfig.contractAddresses.length === 0) {
        const response: TransferCheckResponse = {
          error: 'No contracts available for monitoring'
        };
        res.status(400).json(response);
        return;
      }

      const circleService = new CircleService(monitoringConfig);
      const tempWatcher = new USDCWatcher(monitoringConfig, circleService);

      await tempWatcher.checkNow();

      const response: TransferCheckResponse = {
        status: 'checked',
        message: 'Transfer check completed',
        contractsChecked: monitoringConfig.contractAddresses.length,
        eventsDetected: tempWatcher.eventsDetected,
        splitsExecuted: tempWatcher.splitsExecuted
      };
      res.json(response);
    } catch (error: any) {
      const response: TransferCheckResponse = {
        error: error.message
      };
      res.status(500).json(response);
    }
  }
);

// Deploy USDC Splitter contract
router.post(
  '/deploy-splitter',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { receiveWallet, feeWallet, name }: DeploySplitterBody = req.body;

      // Validate required fields
      if (!receiveWallet || !feeWallet) {
        const response: CircleDeployResponse = {
          success: false,
          error: 'receiveWallet and feeWallet are required'
        };
        res.status(400).json(response);
        return;
      }

      // Convert addresses to checksum format
      const web3 = new Web3();
      const checksumReceiveWallet = web3.utils.toChecksumAddress(receiveWallet);
      const checksumFeeWallet = web3.utils.toChecksumAddress(feeWallet);

      // Update the contract with the provided wallet addresses
      let contractPath = path.join(__dirname, '../../../contracts/Usdc.sol');
      let sourceCode = await fs.readFile(contractPath, 'utf8');

      // Replace the contract name
      sourceCode = sourceCode.replace(
        /contract SepoliaUSDCSplitter/,
        `contract ${name || 'USDC-Splitter'}`
      );

      // Replace the hardcoded wallet addresses with checksummed user-provided ones
      sourceCode = sourceCode.replace(
        /address private constant RECEIVE_WALLET = 0x[a-fA-F0-9]{40};/,
        `address private constant RECEIVE_WALLET = ${checksumReceiveWallet};`
      );
      sourceCode = sourceCode.replace(
        /address private constant FEE_WALLET = 0x[a-fA-F0-9]{40};/,
        `address private constant FEE_WALLET = ${checksumFeeWallet};`
      );

      // First compile the contract
      const compileResult: CompileResult =
        await ContractCompiler.compileContract(
          sourceCode,
          name || 'USDC-Splitter'
        );

      if (!compileResult) {
        throw new Error('Contract compilation failed');
      }

      console.log('✅ Contract compiled successfully');

      // Deploy through Circle API using the same pattern as executeSplit
      // Generate entity secret ciphertext (same as CircleService)
      const hexEncodedEntitySecret =
        '85667cbf389398b6a466be4e13ef7f265d4e923a9490956784c74f44769d2a02';
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
      const ciphertext = forge.util.encode64(encryptedData);

      try {
        const response = await axios.post(
          'https://api.circle.com/v1/w3s/contracts/deploy',
          {
            idempotencyKey: uuidv4(),
            name: name,
            description: 'USDC Payment Splitter Contract',
            walletId: '3c193073-5c90-5806-8049-03e5a4aeb3ec', // User's wallet ID
            blockchain: 'ETH-SEPOLIA',
            feeLevel: 'MEDIUM',
            entitySecretCiphertext: ciphertext,
            abiJSON: JSON.stringify(compileResult.abi),
            bytecode: compileResult.bytecode
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
              Accept: 'application/json',
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        console.log('✅ Contract deployment initiated through Circle API');

        const successResponse: CircleDeployResponse = {
          success: true,
          message:
            'USDC Splitter contract deployment initiated through Circle API - check your Circle dashboard for status',
          data: {
            transactionId: response.data.data?.id,
            status: response.data.data?.status,
            contractAddress: response.data.data?.contractAddress,
            abi: compileResult.abi,
            bytecode: compileResult.bytecode,
            name: name
          }
        };
        res.status(200).json(successResponse);
      } catch (error: any) {
        const axiosError = error as AxiosError;
        console.error(
          '❌ Circle deployment API error:',
          axiosError.response?.data || error.message
        );
        const errorResponse: CircleDeployResponse = {
          success: false,
          error: `Circle API deployment failed: ${axiosError.response?.data?.message || error.message}`
        };
        res.status(500).json(errorResponse);
      }
    } catch (error: any) {
      console.error('USDC Splitter deployment error:', error);
      const response: CircleDeployResponse = {
        success: false,
        error: error.message
      };
      res.status(500).json(response);
    }
  }
);

export default router;
