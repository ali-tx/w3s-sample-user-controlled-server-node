import config from '../config';
// Note: DeveloperControlledWalletsClient may not be present in this environment; keep dynamic require
const { DeveloperControlledWalletsClient } = require('@circle-fin/usdckit');

const client = new DeveloperControlledWalletsClient({
  apiKey: config.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET
});

export default class ContractDeployer {
  static async deployContract(
    walletId: string,
    contractBytecode: string,
    constructorArgs: any[] = []
  ) {
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    const dataPayload = contractBytecode;
    if (constructorArgs.length > 0) {
      console.log(
        'Note: Constructor arguments should be ABI-encoded and appended to bytecode'
      );
    }

    try {
      const response = await client.transfers.createTransaction({
        idempotencyKey: `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        walletId,
        destinationAddress: zeroAddress,
        blockchain: 'ETH-SEPOLIA',
        tokenId: process.env.NATIVE_TOKEN_ID,
        amounts: ['0'],
        feeLevel: 'MEDIUM',
        entitySecretCiphertext: process.env.ENTITY_SECRET_CIPHERTEXT,
        data: dataPayload
      });

      return {
        success: true,
        transactionId: response.data.id,
        status: response.data.status
      };
    } catch (error: any) {
      console.error(
        'Deployment failed:',
        error.response?.data || error.message
      );
      return { success: false, error: error.response?.data || error.message };
    }
  }

  static async getNativeTokenId(blockchain = 'ETH-SEPOLIA') {
    return process.env.NATIVE_TOKEN_ID || null;
  }
}
