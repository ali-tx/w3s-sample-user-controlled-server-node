import 'dotenv/config';
import { DeveloperControlledWalletsClient } from '@circle-fin/usdckit';

interface DeployContractParams {
  walletId: string;
  contractBytecode: string;
  constructorArgs?: any[];
}

interface DeploymentResult {
  success: boolean;
  transactionId?: string;
  status?: string;
  error?: any;
}

interface CircleTransactionResponse {
  data: {
    id: string;
    status: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface CircleErrorResponse {
  response?: {
    data?: any;
  };
  message?: string;
}

// Initialize the Circle client
const client = new DeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY as string,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET as string
});

class ContractDeployer {
  static async deployContract(
    walletId: string,
    contractBytecode: string,
    constructorArgs: any[] = []
  ): Promise<DeploymentResult> {
    // For contract deployment, destination is the zero address
    const zeroAddress = '0x0000000000000000000000000000000000000000';

    // If you have constructor arguments, encode them and append to bytecode
    let dataPayload = contractBytecode;
    if (constructorArgs.length > 0) {
      // In a real scenario, you would encode constructor arguments here
      // This is a simplified example
      console.log('Note: Constructor arguments would be encoded here');
    }

    try {
      const response: CircleTransactionResponse =
        await client.transfers.createTransaction({
          idempotencyKey: `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          walletId: walletId,
          destinationAddress: zeroAddress,
          blockchain: 'ETH-SEPOLIA', // or your target blockchain
          tokenId: process.env.NATIVE_TOKEN_ID as string, // e.g., Sepolia ETH token ID
          amounts: ['0'], // No value transfer for deployment
          feeLevel: 'MEDIUM', // Use MEDIUM or HIGH for more reliable deployment
          entitySecretCiphertext: process.env
            .ENTITY_SECRET_CIPHERTEXT as string,
          data: dataPayload // The contract bytecode
        });

      console.log('Deployment transaction submitted:', response.data);
      return {
        success: true,
        transactionId: response.data.id,
        status: response.data.status
        // Note: The actual contract address will be available once mined
      };
    } catch (error: any) {
      const circleError = error as CircleErrorResponse;
      console.error(
        'Deployment failed:',
        circleError.response?.data || error.message
      );
      return {
        success: false,
        error: circleError.response?.data || error.message
      };
    }
  }

  // Helper: Get the native token ID for gas (ETH-SEPOLIA)
  static async getNativeTokenId(
    blockchain: string = 'ETH-SEPOLIA'
  ): Promise<string | undefined> {
    // You would typically fetch this from Circle's tokens list
    // For Sepolia, this is often a fixed ID
    return process.env.NATIVE_TOKEN_ID; // Set in your .env
  }
}

export default ContractDeployer;
