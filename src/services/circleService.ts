import { v4 as uuidv4 } from 'uuid';
// @ts-expect-error node-forge has no types
import forge from 'node-forge';
import axios from 'axios';

interface CircleConfig {
  circleWalletId: string;
  circleApiKey: string;
}

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

export default class CircleService {
  config: CircleConfig;

  constructor(config: CircleConfig) {
    this.config = config;
  }

  encryptEntitySecret() {
    const entitySecret = forge.util.hexToBytes(hexEncodedEntitySecret);
    if (entitySecret.length !== 32)
      throw new Error('Invalid entity secret length');
    const publicKey = forge.pki.publicKeyFromPem(publicKeyString);
    const encryptedData = publicKey.encrypt(entitySecret, 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      mgf1: { md: forge.md.sha256.create() }
    });
    return forge.util.encode64(encryptedData);
  }

  async executeReceive(amount: number, contractAddress: string) {
    const { v4: uuidv4 } = await import('uuid');
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

      const response = await axios.post(
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

      return { success: true, transactionId: response.data.data?.id, amount };
    } catch (error: unknown) {
      throw new Error(`Circle API failed: ${(error as Error).message}`);
    }
  }

  async executeSplit(amount: number, contractAddress: string) {
    const { v4: uuidv4 } = await import('uuid');
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

      const response = await axios.post(
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

      return { success: true, transactionId: response.data.data?.id, amount };
    } catch (error: unknown) {
      throw new Error(`Circle API failed: ${(error as Error).message}`);
    }
  }

  async fetchContractsFromTransactions() {
    return [];
  }
}
