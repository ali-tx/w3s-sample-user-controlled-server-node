"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileAndDeploy = compileAndDeploy;
const contractCompiler_1 = __importDefault(require("../services/external/contractCompiler"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const circleService_1 = __importDefault(require("../services/external/circleService"));
const services_1 = require("../services");
async function pollContractStatus(circleContractId, id, userId, name, artifactPath, walletAddress) {
    const maxPolls = 300; // 2 hours if polling every 30s
    let polls = 0;
    const pollInterval = setInterval(async () => {
        try {
            const contractData = await circleService_1.default.getContract(circleContractId);
            if (contractData.status === 'COMPLETE') {
                clearInterval(pollInterval);
                // Update DB with contractAddress
                services_1.contractDAO.insertContract({
                    id,
                    userId,
                    name,
                    contractAddress: contractData.contractAddress || contractData.address,
                    artifactPath,
                    status: 'deployed',
                    walletAddress,
                    contractId: circleContractId
                });
            }
            else if (polls >= maxPolls) {
                clearInterval(pollInterval);
                // Update status to failed
                services_1.contractDAO.insertContract({
                    id,
                    userId,
                    name,
                    artifactPath,
                    status: 'failed',
                    walletAddress,
                    contractId: circleContractId
                });
            }
            polls++;
        }
        catch (err) {
            console.error('Polling error', err);
            clearInterval(pollInterval);
        }
    }, 30000);
}
async function compileAndDeploy(req, res, next) {
    try {
        const { source, name } = req.body;
        if (!source || !name)
            return res.status(400).json({ error: 'source and name required' });
        const out = contractCompiler_1.default.compileSource(`${name}.sol`, source);
        const file = out.contracts?.[`${name}.sol`];
        const contractName = Object.keys(file || {})[0];
        const abi = file[contractName].abi;
        const bytecode = file[contractName].evm.bytecode.object;
        const artifactsDir = path_1.default.join(__dirname, '..', 'services', 'contracts');
        fs_1.default.mkdirSync(artifactsDir, { recursive: true });
        const artifactPath = path_1.default.join(artifactsDir, `${name}.json`);
        fs_1.default.writeFileSync(artifactPath, JSON.stringify({ abi, bytecode }, null, 2));
        const resp = await circleService_1.default.deployContract(bytecode, name, abi);
        console.log('Deploy contract initiate response:', resp);
        // Get userId from token
        const userToken = req.headers['token'];
        let userId = null;
        let walletAddress = null;
        if (userToken) {
            try {
                const payload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString());
                userId = payload.sub || payload.user_id || payload.userId;
                if (userId) {
                    const listResp = await services_1.circleUserSdk.listWallets({
                        userToken
                    });
                    const latestWallet = listResp.data?.wallets?.[0];
                    walletAddress = latestWallet?.address || null;
                }
            }
            catch (err) {
                console.warn('Failed to get user and wallet info', err);
            }
        }
        let id = '';
        let status = 'compiled';
        const contractAddress = resp.contractAddress || resp.address;
        const circleContractId = resp.id;
        let contractId = undefined;
        if (userId) {
            id = `${userId}-${Date.now()}`;
            contractId = circleContractId;
            if (contractAddress) {
                status = 'deployed';
            }
            else if (circleContractId) {
                status = 'pending';
                // Start polling
                pollContractStatus(circleContractId, id, userId, name, artifactPath, walletAddress);
            }
            services_1.contractDAO.insertContract({
                id,
                userId,
                name,
                contractAddress,
                artifactPath,
                status,
                walletAddress,
                contractId
            });
        }
        res.status(200).send({ artifactPath, resp, contractId });
    }
    catch (err) {
        next(err);
    }
}
exports.default = { compileAndDeploy };
