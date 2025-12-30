import axios, { AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import Web3 from 'web3';

// Circle entity secret and public key for encryption
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

interface CircleContract {
  contractAddress?: string;
  address?: string;
  [key: string]: any;
}

interface CircleApiResponse {
  data?: {
    contracts?: CircleContract[];
    [key: string]: any;
  };
  contracts?: CircleContract[];
  [key: string]: any;
}

interface StoredContracts {
  lastUpdated: string;
  contracts: string[];
}

interface ContractExecutionPayload {
  idempotencyKey: string;
  walletId: string;
  contractAddress: string;
  abiFunctionSignature: string;
  abiParameters: string[];
  feeLevel: string;
  entitySecretCiphertext: string;
}

class CircleApiService {
  baseURL: string;
  apiKey: string | undefined;
  walletId: string | undefined;
  contractAddresses: string[] = [];

  constructor() {
    this.baseURL = 'https://api.circle.com/v1/w3s/developer/transactions';
    this.apiKey = process.env.CIRCLE_API_KEY;
    this.walletId = process.env.CIRCLE_WALLET_ID;
    this.contractAddresses = [];
    console.log(
      'CircleApiService initialized with API key ending:',
      this.apiKey ? this.apiKey.slice(-10) : 'undefined'
    );
  }

  encryptEntitySecret(): string {
    console.log('🔐 Generating fresh entity secret ciphertext...');
    const entitySecret = forge.util.hexToBytes(hexEncodedEntitySecret);
    if (entitySecret.length !== 32) {
      throw new Error('Invalid entity secret length');
    }

    // Encrypt data by the public key
    const publicKey = forge.pki.publicKeyFromPem(publicKeyString);
    const encryptedData = publicKey.encrypt(entitySecret, 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      mgf1: {
        md: forge.md.sha256.create()
      }
    });

    // Encode to base64
    const ciphertext = forge.util.encode64(encryptedData);
    console.log('✅ Fresh ciphertext generated');
    return ciphertext;
  }

  async validateContractHasSplitFunction(
    contractAddress: string
  ): Promise<boolean> {
    try {
      // Validate contract address format
      if (
        !contractAddress ||
        !contractAddress.startsWith('0x') ||
        contractAddress.length !== 42
      ) {
        console.log(`❌ Invalid contract address format: ${contractAddress}`);
        return false;
      }

      // Check if RPC URL is configured
      const rpcUrl =
        process.env.INFURA_RPC_URL ||
        `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`;
      if (
        !rpcUrl.includes('infura.io') &&
        !rpcUrl.includes(process.env.INFURA_API_KEY)
      ) {
        throw new Error(
          'INFURA_API_KEY not configured - required for blockchain validation'
        );
      }

      const web3 = new Web3(rpcUrl);

      // Check if contract has splitUSDC function
      const functionSignature = 'splitUSDC(uint256)';
      const functionSelector =
        web3.eth.abi.encodeFunctionSignature(functionSignature);

      // Try to call the function with amount 0 (should fail but confirm function exists)
      const callData =
        functionSelector +
        web3.eth.abi.encodeParameters(['uint256'], ['0']).slice(2);

      try {
        await web3.eth.call({
          to: contractAddress,
          data: callData,
          gas: '50000' // Minimal gas for function check
        });
        // If we get here without revert, function exists but might succeed with amount 0
        return true;
      } catch (callError: any) {
        // Check if error is due to function not existing vs other reasons
        if (
          callError.message.includes('function') ||
          callError.message.includes('method') ||
          callError.message.includes('invalid opcode')
        ) {
          return false; // Function doesn't exist
        } else if (callError.message.includes('revert')) {
          return true; // Function exists but reverted (expected for amount 0)
        } else if (callError.message.includes('execution reverted')) {
          return true; // Function exists but business logic reverted
        }
        // Other errors (like network issues) - assume function exists
        return true;
      }
    } catch (error: any) {
      let errorMessage = `Could not validate contract ${contractAddress}`;

      if (error.message.includes('Invalid JSON RPC response')) {
        errorMessage += ' - RPC connection failed, check INFURA_API_KEY';
      } else if (error.message.includes('connection')) {
        errorMessage += ' - Network connectivity issue';
      } else if (error.message.includes('timeout')) {
        errorMessage += ' - Blockchain request timeout';
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      }

      console.log(`⚠️ ${errorMessage}`);
      return false; // Fail safe - don't include contracts we can't validate
    }
  }

  async fetchContractAddresses(): Promise<string[]> {
    try {
      console.log(
        '🔍 Fetching deployed contracts from Circle Dashboard API...'
      );

      // Check if API key is configured
      if (!this.apiKey) {
        throw new Error(
          'CIRCLE_API_KEY not configured in environment variables'
        );
      }

      // Try the contracts list endpoint using axios with exact headers to match curl
      console.log(
        '🔑 Making Circle API call with key ending:',
        this.apiKey.slice(-10)
      );

      const response = await axios.get<CircleApiResponse>(
        'https://api.circle.com/v1/w3s/contracts',
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'curl/7.68.0'
          },
          timeout: 30000,
          validateStatus: function (status: number): boolean {
            return status < 500; // Accept any status less than 500
          }
        }
      );

      console.log('📡 Circle API response status:', response.status);

      if (response.status === 200 && response.data) {
        const contracts =
          response.data.data?.contracts || response.data.contracts || [];

        if (!Array.isArray(contracts)) {
          throw new Error(
            'Circle API response format invalid - expected contracts array'
          );
        }

        const allContractAddresses = contracts
          .map((c: CircleContract) => c.contractAddress || c.address)
          .filter(
            (addr: string | undefined): addr is string =>
              addr !== undefined && addr !== 'N/A' && addr.startsWith('0x')
          );

        console.log(
          `🔢 Circle contracts found: ${allContractAddresses.length}`
        );

        if (allContractAddresses.length === 0) {
          console.log(
            '⚠️ No valid contract addresses found in Circle response'
          );
          return await this.loadContractsFromStorage();
        }

        // Validate each contract has splitUSDC function
        const validContracts: string[] = [];
        const invalidContracts: string[] = [];

        for (const address of allContractAddresses) {
          try {
            const isValid =
              await this.validateContractHasSplitFunction(address);
            if (isValid) {
              validContracts.push(address);
            } else {
              invalidContracts.push(address);
            }
          } catch (validationError: any) {
            console.log(
              `❌ Validation failed for ${address}: ${validationError.message}`
            );
            invalidContracts.push(address);
          }
        }

        console.log(`✅ Valid USDC splitters: ${validContracts.length}`);
        console.log(`❌ Invalid contracts: ${invalidContracts.length}`);

        if (validContracts.length > 0) {
          validContracts.forEach((addr: string, i: number) => {
            console.log(`   ${i + 1}. ${addr}`);
          });
        } else {
          console.log('⚠️ No contracts have the required splitUSDC function');
        }

        this.contractAddresses = validContracts;

        // Save to persistent storage for scalability
        await this.saveContractsToStorage(validContracts);

        return this.contractAddresses;
      } else {
        const errorMsg = `Circle API returned status ${response.status}: ${response.statusText || 'Unknown error'}`;
        console.log(`⚠️ ${errorMsg} - using cached contracts`);
        return await this.loadContractsFromStorage();
      }
    } catch (error: any) {
      const axiosError = error as AxiosError;
      let errorMessage = 'Unknown error occurred';

      if (error.code === 'ENOTFOUND') {
        errorMessage = 'Network error: Cannot reach Circle API servers';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused: Circle API servers may be down';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = 'Timeout: Circle API request took too long';
      } else if (axiosError.response?.status === 401) {
        errorMessage = 'Authentication failed: Invalid API key';
      } else if (axiosError.response?.status === 403) {
        errorMessage = 'Forbidden: API key does not have permission';
      } else if (axiosError.response?.status === 404) {
        errorMessage = 'Not found: Contracts endpoint may have changed';
      } else if (error.message) {
        errorMessage = error.message;
      }

      console.log(`❌ Circle contracts API failed: ${errorMessage}`);
      console.log('💡 Falling back to cached contracts from storage');
      return await this.loadContractsFromStorage();
    }
  }

  async saveContractsToStorage(contractAddresses: string[]): Promise<void> {
    try {
      const storagePath = path.join(
        __dirname,
        '../../contracts/deployed-contracts.json'
      );

      const data: StoredContracts = {
        lastUpdated: new Date().toISOString(),
        contracts: contractAddresses
      };

      await fs.writeFile(storagePath, JSON.stringify(data, null, 2));
      console.log(`💾 Saved ${contractAddresses.length} contracts to storage`);
    } catch (error) {
      console.error('❌ Failed to save contracts to storage:', error);
    }
  }

  async loadContractsFromStorage(): Promise<string[]> {
    try {
      const storagePath = path.join(
        __dirname,
        '../../contracts/deployed-contracts.json'
      );

      const data = await fs.readFile(storagePath, 'utf8');
      const parsed: StoredContracts = JSON.parse(data);

      if (parsed.contracts && Array.isArray(parsed.contracts)) {
        // Re-validate contracts on load (in case blockchain state changed)
        const validContracts: string[] = [];
        for (const address of parsed.contracts) {
          if (await this.validateContractHasSplitFunction(address)) {
            validContracts.push(address);
          }
        }

        this.contractAddresses = validContracts;
        console.log(
          `📋 Loaded ${this.contractAddresses.length} valid contracts from storage (last updated: ${parsed.lastUpdated})`
        );
        return this.contractAddresses;
      }
    } catch (error) {
      console.log('📝 No stored contracts found');
    }

    return [];
  }

  async listAllContracts(): Promise<string[]> {
    // Force refresh from API, then return current list
    await this.fetchContractAddresses();
    return this.contractAddresses;
  }

  async triggerSplit(
    contractAddress: string,
    amount: string | number
  ): Promise<any> {
    try {
      // Validate contract is in our list
      if (!this.contractAddresses.includes(contractAddress)) {
        await this.fetchContractAddresses(); // Refresh list
        if (!this.contractAddresses.includes(contractAddress)) {
          throw new Error(
            `Contract ${contractAddress} not found in deployed contracts`
          );
        }
      }

      // Generate fresh ciphertext for this API call
      const freshCiphertext = this.encryptEntitySecret();

      const payload: ContractExecutionPayload = {
        idempotencyKey: uuidv4(),
        walletId: this.walletId!,
        contractAddress,
        abiFunctionSignature: 'splitUSDC(uint256)',
        abiParameters: [amount.toString()],
        feeLevel: 'MEDIUM',
        entitySecretCiphertext: freshCiphertext
      };

      console.log(`📤 Calling Circle API for contract ${contractAddress}`);

      const response = await axios.post(
        `${this.baseURL}/contractExecution`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Circle API success`);
      return response.data;
    } catch (error: any) {
      const axiosError = error as AxiosError;
      console.error(
        '❌ Circle API error:',
        axiosError.response?.data || error.message
      );
      throw new Error(`Circle API failed: ${error.message}`);
    }
  }
}

export default new CircleApiService();
