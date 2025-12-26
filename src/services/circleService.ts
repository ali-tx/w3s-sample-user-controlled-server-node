import axios, { AxiosError, AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as forge from 'node-forge';

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

interface CircleConfig {
  circleApiKey: string;
  circleWalletId: string;
}

interface CircleTransactionResponse {
  data?: {
    id: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface CircleTransaction {
  contractAddress?: string;
  [key: string]: any;
}

interface SplitResult {
  success: boolean;
  transactionId?: string;
  amount: number;
}

interface ExecuteSplitPayload {
  idempotencyKey: string;
  walletId: string;
  contractAddress: string;
  abiFunctionSignature: string;
  abiParameters: string[];
  feeLevel: string;
  entitySecretCiphertext: string;
}

interface CircleTransactionsResponse {
  data?: CircleTransaction[];
  [key: string]: any;
}

class CircleService {
  private config: CircleConfig;
  private baseUrl: string;

  constructor(config: CircleConfig) {
    this.config = config;
    this.baseUrl = 'https://api-sandbox.circle.com/v1/w3s/developer'; // Updated to sandbox
  }

  private encryptEntitySecret(): string {
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

  async executeSplit(
    amount: number,
    contractAddress: string
  ): Promise<SplitResult> {
    try {
      const ciphertext = this.encryptEntitySecret();

      const payload: ExecuteSplitPayload = {
        idempotencyKey: uuidv4(),
        walletId: this.config.circleWalletId,
        contractAddress: contractAddress,
        abiFunctionSignature: 'splitUSDC(uint256)',
        abiParameters: [amount.toString()],
        feeLevel: 'MEDIUM',
        entitySecretCiphertext: ciphertext
      };

      console.log('📤 Calling Circle API...');

      const response: AxiosResponse<CircleTransactionResponse> =
        await axios.post(
          `${this.baseUrl}/transactions/contractExecution`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${this.config.circleApiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

      return {
        success: true,
        transactionId: response.data.data?.id,
        amount: amount
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(
        '❌ Circle API Error:',
        axiosError.response?.data || axiosError.message
      );
      throw new Error(`Circle API failed: ${axiosError.message}`);
    }
  }

  async fetchContractsFromTransactions(
    hoursBack: number = 24
  ): Promise<string[]> {
    try {
      console.log(
        `🔍 Fetching contracts from Circle transactions (last ${hoursBack} hours)...`
      );

      // Calculate date hoursBack hours ago
      const fromDate = new Date(
        Date.now() - hoursBack * 60 * 60 * 1000
      ).toISOString();

      const response: AxiosResponse<CircleTransactionsResponse> =
        await axios.get(`${this.baseUrl}/transactions`, {
          headers: {
            Authorization: `Bearer ${this.config.circleApiKey}`,
            'Content-Type': 'application/json'
          },
          params: {
            from: fromDate
          },
          timeout: 30000
        });

      const transactions = response.data.data || [];
      const contracts = [
        ...new Set(
          transactions
            .map((tx) => tx.contractAddress)
            .filter((addr): addr is string => !!addr)
        )
      ];

      console.log(
        `✅ Found ${contracts.length} unique contracts from ${transactions.length} transactions (last ${hoursBack}h)`
      );
      return contracts;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(
        '❌ Failed to fetch contracts from Circle:',
        axiosError.response?.data || axiosError.message
      );

      // For development/testing, return empty array instead of throwing
      console.log('⚠️ Returning empty contracts array for development');
      return [];
    }
  }
}

export default CircleService;
