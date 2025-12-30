import axios, { AxiosResponse } from 'axios';
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

interface MonitoringConfig {
  rpcUrl: string;
  wsUrl: string;
  contractAddresses: string[];
  usdcAddress: string;
  circleApiKey: string;
  circleWalletId: string;
  processHistoricalTransfers: boolean;
}

interface ExecuteSplitResult {
  success: boolean;
  transactionId: string;
  amount: number;
}

class CircleService {
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig) {
    this.config = config;
  }

  encryptEntitySecret(): string {
    const entitySecret = forge.util.hexToBytes(hexEncodedEntitySecret);
    if (entitySecret.length !== 32) {
      throw new Error('Invalid entity secret length');
    }

    const publicKey = forge.pki.publicKeyFromPem(publicKeyString);
    const encryptedData = publicKey.encrypt(entitySecret, 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      mgf1: {
        md: forge.md.sha256.create()
      }
    });

    return forge.util.encode64(encryptedData);
  }

  async executeSplit(
    amount: number,
    contractAddress: string
  ): Promise<ExecuteSplitResult> {
    try {
      const ciphertext = this.encryptEntitySecret();

      const payload = {
        idempotencyKey: uuidv4(),
        walletId: this.config.circleWalletId,
        contractAddress: contractAddress,
        abiFunctionSignature: 'splitUSDC(uint256)',
        abiParameters: [amount.toString()],
        feeLevel: 'MEDIUM',
        entitySecretCiphertext: ciphertext
      };

      // Silent API call

      const response: AxiosResponse = await axios.post(
        'https://api.circle.com/v1/w3s/developer/transactions/contractExecution',
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
    } catch (error: any) {
      console.error(
        '❌ Circle API Error:',
        error.response?.data || error.message
      );
      throw new Error(`Circle API failed: ${error.message}`);
    }
  }

  async fetchContractsFromTransactions(
    hoursBack: number = 24
  ): Promise<string[]> {
    // Not used - we use contract list API instead
    return [];
  }
}

export default CircleService;
