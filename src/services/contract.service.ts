import fs from 'fs/promises';
import path from 'path';
import ContractCompiler from './contractCompiler';
import circleApiService from './circleApiService';

class ContractService {
  contractsDir: string;

  constructor() {
    this.contractsDir = path.join(__dirname, '../../contracts');
    this.initContractsDirectory().catch(() => {});
  }

  async initContractsDirectory() {
    try {
      await fs.access(this.contractsDir);
    } catch {
      await fs.mkdir(this.contractsDir, { recursive: true });
    }
  }

  async compileAndDeploy(contractData: any) {
    try {
      const compileResult = await ContractCompiler.compileContract(
        contractData.sourceCode,
        contractData.name
      );
      const deployment = {
        contractId: `${contractData.name}_${Date.now()}`,
        contractName: contractData.name,
        network: contractData.network || 'local',
        abi: compileResult.abi,
        bytecode: compileResult.bytecode,
        timestamp: Date.now(),
        status: 'compiled'
      };

      const deploymentPath = path.join(
        this.contractsDir,
        `deployment_${deployment.contractId}.json`
      );
      await fs.writeFile(deploymentPath, JSON.stringify(deployment, null, 2));
      return { success: true, deployment };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getContractTemplates() {
    return {
      ERC20: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyToken { /* ... */ }`,
      SimpleStorage: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleStorage { /* ... */ }`,
      Counter: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Counter { /* ... */ }`
    };
  }

  async getAvailableNetworks() {
    return ['vm', 'goerli', 'sepolia', 'mainnet', 'polygon'];
  }

  async getAllContracts() {
    try {
      const contracts: any[] = [];
      try {
        const files = await fs.readdir(this.contractsDir);
        for (const file of files) {
          if (file.endsWith('.json') && file.startsWith('deployment_')) {
            const filePath = path.join(this.contractsDir, file);
            const content = await fs.readFile(filePath, 'utf8');
            const localContract = JSON.parse(content);
            localContract.type = 'local';
            contracts.push(localContract);
          }
        }
      } catch (localError: any) {
        // ignore
      }

      try {
        const circleContracts = await circleApiService.listAllContracts();
        for (const address of circleContracts) {
          contracts.push({
            contractAddress: address,
            type: 'circle',
            network: 'circle',
            status: 'deployed',
            timestamp: Date.now(),
            abi: null,
            bytecode: null
          });
        }
      } catch (circleError: any) {
        // ignore
      }

      return contracts.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      return [];
    }
  }
}

export default new ContractService();
