"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const contractCompiler_1 = __importDefault(require("./contractCompiler"));
const circleApiService_1 = __importDefault(require("./circleApiService"));
class ContractService {
    constructor() {
        this.contractsDir = path_1.default.join(__dirname, '../../contracts');
        this.initContractsDirectory().catch(() => { });
    }
    async initContractsDirectory() {
        try {
            await promises_1.default.access(this.contractsDir);
        }
        catch {
            await promises_1.default.mkdir(this.contractsDir, { recursive: true });
        }
    }
    async compileAndDeploy(contractData) {
        try {
            const compileResult = await contractCompiler_1.default.compileContract(contractData.sourceCode, contractData.name);
            const deployment = {
                contractId: `${contractData.name}_${Date.now()}`,
                contractName: contractData.name,
                network: contractData.network || 'local',
                abi: compileResult.abi,
                bytecode: compileResult.bytecode,
                timestamp: Date.now(),
                status: 'compiled'
            };
            const deploymentPath = path_1.default.join(this.contractsDir, `deployment_${deployment.contractId}.json`);
            await promises_1.default.writeFile(deploymentPath, JSON.stringify(deployment, null, 2));
            return { success: true, deployment };
        }
        catch (error) {
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
            const contracts = [];
            try {
                const files = await promises_1.default.readdir(this.contractsDir);
                for (const file of files) {
                    if (file.endsWith('.json') && file.startsWith('deployment_')) {
                        const filePath = path_1.default.join(this.contractsDir, file);
                        const content = await promises_1.default.readFile(filePath, 'utf8');
                        const localContract = JSON.parse(content);
                        localContract.type = 'local';
                        contracts.push(localContract);
                    }
                }
            }
            catch (localError) {
                // ignore
            }
            try {
                const circleContracts = await circleApiService_1.default.listAllContracts();
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
            }
            catch (circleError) {
                // ignore
            }
            return contracts.sort((a, b) => b.timestamp - a.timestamp);
        }
        catch (error) {
            return [];
        }
    }
}
exports.default = new ContractService();
