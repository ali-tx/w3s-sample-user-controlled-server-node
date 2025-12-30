// backend/src/routes/deploy.ts
import express, { Router, Request, Response } from 'express';
import ContractCompiler from '../services/contractCompiler';
import ContractDeployer from '../services/contractDeployer';

const router: Router = express.Router();

interface DeploymentResult {
  success: boolean;
  transactionId?: string;
  status?: string;
  error?: string;
}

interface GreeterDeploymentResponse {
  message: string;
  transactionId?: string;
  status?: string;
  abi: any;
  contractName: string;
  note: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

router.post(
  '/deploy-greeter',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { greeting = 'Hello Circle!', walletId = process.env.WALLET_ID } =
        req.body;

      // 1. Generate and compile the contract
      const sourceCode = ContractCompiler.getContractSource('Greeter');
      const compiled = ContractCompiler.compileContract(sourceCode);

      console.log('Contract compiled successfully:', compiled.contractName);

      // 2. Prepare constructor arguments
      // For Greeter, we need to encode the greeting string
      // This is simplified - in reality, use web3.eth.abi.encodeParameters
      const greetingEncoded = greeting;

      // 3. Deploy the contract
      const deploymentResult: DeploymentResult =
        await ContractDeployer.deployContract(walletId, compiled.bytecode, [
          greetingEncoded
        ]);

      // 4. Return result
      if (deploymentResult.success) {
        const response: GreeterDeploymentResponse = {
          message: 'Contract deployment initiated',
          transactionId: deploymentResult.transactionId,
          status: deploymentResult.status,
          abi: compiled.abi, // Save this for future interactions
          contractName: compiled.contractName,
          note: 'Contract address will be available once the transaction is mined.'
        };
        res.status(200).json(response);
      } else {
        const errorResponse: ErrorResponse = {
          error: 'Deployment failed',
          details: deploymentResult.error
        };
        res.status(500).json(errorResponse);
      }
    } catch (error: any) {
      console.error('Deployment error:', error);
      const errorResponse: ErrorResponse = {
        error: 'Internal server error',
        details: error.message
      };
      res.status(500).json(errorResponse);
    }
  }
);

export default router;
