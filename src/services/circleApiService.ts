// @ts-expect-error node-forge has no types
import forge from 'node-forge';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import config from '../config';

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

class CircleApiService {
  baseURL: string;
  apiKey: string | null;
  walletId: string | null;
  contractAddresses: string[];

  constructor() {
    this.baseURL = `${config.CIRCLE_API_BASE_URL}/v1/w3s/developer/transactions`;
    this.apiKey = config.CIRCLE_API_KEY;
    this.walletId = config.CIRCLE_WALLET_ID;
    this.contractAddresses = [];
  }

  encryptEntitySecret() {
    const entitySecret = forge.util.hexToBytes(hexEncodedEntitySecret);
    const publicKey = forge.pki.publicKeyFromPem(publicKeyString);
    const encryptedData = publicKey.encrypt(entitySecret, 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      mgf1: { md: forge.md.sha256.create() }
    });
    const ciphertext = forge.util.encode64(encryptedData);
    return ciphertext;
  }

  async validateContractHasSplitFunction(contractAddress: string) {
    try {
      if (
        !contractAddress ||
        !contractAddress.startsWith('0x') ||
        contractAddress.length !== 42
      )
        return false;
      const { Web3 } = await import('web3');
      const rpcUrl =
        config.INFURA_RPC_URL ||
        (config.INFURA_API_KEY
          ? `https://sepolia.infura.io/v3/${config.INFURA_API_KEY}`
          : null);
      if (!rpcUrl)
        throw new Error('INFURA_RPC_URL or INFURA_API_KEY not configured');
      const web3 = new Web3(rpcUrl as string);
      const functionSignature = 'splitUSDC(uint256)';
      const functionSelector =
        web3.eth.abi.encodeFunctionSignature(functionSignature);
      const callData =
        functionSelector +
        web3.eth.abi.encodeParameters(['uint256'], ['0']).slice(2);
      try {
        await web3.eth.call({
          to: contractAddress,
          data: callData,
          gas: 50000
        });
        return true;
      } catch (callError: any) {
        const msg = callError?.message || '';
        if (msg.includes('revert') || msg.includes('execution reverted'))
          return true;
        if (msg.includes('function') || msg.includes('invalid opcode'))
          return false;
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  async saveContractsToStorage(contractAddresses: string[]) {
    try {
      const storagePath = path.join(
        __dirname,
        '../../contracts/deployed-contracts.json'
      );
      const data = {
        lastUpdated: new Date().toISOString(),
        contracts: contractAddresses
      };
      await fs.writeFile(storagePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save contracts to storage', error);
    }
  }

  async loadContractsFromStorage(): Promise<string[]> {
    try {
      const storagePath = path.join(
        __dirname,
        '../../contracts/deployed-contracts.json'
      );
      const data = await fs.readFile(storagePath, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed.contracts && Array.isArray(parsed.contracts)) {
        const validContracts: string[] = [];
        for (const addr of parsed.contracts) {
          if (await this.validateContractHasSplitFunction(addr))
            validContracts.push(addr);
        }
        this.contractAddresses = validContracts;
        return this.contractAddresses;
      }
    } catch (error) {
      // ignore
    }
    return [];
  }

  async fetchContractAddresses(): Promise<string[]> {
    try {
      if (!this.apiKey) throw new Error('CIRCLE_API_KEY not configured');
      const response = await axios.get(
        'https://api.circle.com/v1/w3s/contracts',
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'curl/7.68.0'
          },
          timeout: 30000,
          validateStatus: (s) => s < 500
        }
      );
      if (response.status === 200 && response.data) {
        const contracts =
          response.data.data?.contracts || response.data.contracts || [];
        const allContractAddresses = contracts
          .map((c: any) => c.contractAddress || c.address)
          .filter((addr: any) => addr && addr.startsWith('0x'));
        const validContracts: string[] = [];
        for (const address of allContractAddresses) {
          if (await this.validateContractHasSplitFunction(address))
            validContracts.push(address);
        }
        this.contractAddresses = validContracts;
        await this.saveContractsToStorage(validContracts);
        return this.contractAddresses;
      }
      return await this.loadContractsFromStorage();
    } catch (error: any) {
      return await this.loadContractsFromStorage();
    }
  }

  async listAllContracts() {
    await this.fetchContractAddresses();
    return this.contractAddresses;
  }

  async triggerSplit(contractAddress: string, amount: number) {
    const { v4: uuidv4 } = await import('uuid');
    await this.fetchContractAddresses();
    if (!this.contractAddresses.includes(contractAddress))
      throw new Error(`Contract ${contractAddress} not found`);
    const freshCiphertext = this.encryptEntitySecret();
    const payload = {
      idempotencyKey: uuidv4(),
      walletId: this.walletId,
      contractAddress,
      abiFunctionSignature: 'splitUSDC(uint256)',
      abiParameters: [amount.toString()],
      feeLevel: 'MEDIUM',
      entitySecretCiphertext: freshCiphertext
    };
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
    return response.data;
  }
}

export default new CircleApiService();
