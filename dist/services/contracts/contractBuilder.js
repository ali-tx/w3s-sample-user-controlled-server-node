"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContractForUser = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../logging/logger");
const config_1 = __importDefault(require("../../config"));
const circleService_1 = __importDefault(require("../external/circleService"));
const web3_1 = require("web3");
const web3 = new web3_1.Web3();
function sanitizeName(name) {
    const cleaned = name.replace(/[^A-Za-z0-9_]/g, '_');
    if (/^[0-9]/.test(cleaned))
        return `C${cleaned}`;
    return cleaned;
}
const createContractForUser = async (userId, name, receiverWalletAddress, userToken) => {
    try {
        const repoRoot = path_1.default.resolve(__dirname, '../../..');
        const srcSolPath = path_1.default.join(repoRoot, 'src', 'routers', 'contracts', 'Usdc.sol');
        if (!fs_1.default.existsSync(srcSolPath)) {
            logger_1.logger.warn(`Contract template not found at ${srcSolPath}`);
            return { deployed: false };
        }
        const raw = fs_1.default.readFileSync(srcSolPath, 'utf8');
        // Replace the receive/fee addresses and contract name
        const sanitized = sanitizeName(name);
        let modified = raw.replace(/contract\s+[A-Za-z0-9_]+\s*{/m, `contract ${sanitized} {`);
        // Replace hardcoded RECEIVE_WALLET and FEE_WALLET lines (simple replace)
        modified = modified.replace(/address\s+private\s+constant\s+RECEIVE_WALLET\s*=\s*[^;]+;/m, `address private constant RECEIVE_WALLET = ${web3.utils.toChecksumAddress(receiverWalletAddress)};`);
        modified = modified.replace(/address\s+private\s+constant\s+FEE_WALLET\s*=\s*[^;]+;/m, `address private constant FEE_WALLET = 0xdDB2FD31fE60977a58600D757737ae4BFaCD3d04;`);
        // write to tmp folder
        const outDir = path_1.default.join(repoRoot, 'src', 'services', 'contracts', 'tmp');
        fs_1.default.mkdirSync(outDir, { recursive: true });
        const outFile = path_1.default.join(outDir, `${userId}_${sanitized}.sol`);
        fs_1.default.writeFileSync(outFile, modified, 'utf8');
        // If external contract builder service is configured, call it
        const builderUrl = config_1.default.CONTRACT_BUILDER_URL;
        if (builderUrl) {
            try {
                const feeWalletAddress = '0xdDB2FD31fE60977a58600D757737ae4BFaCD3d04';
                const url = `${builderUrl.replace(/\/$/, '')}/deploy`;
                const resp = await axios_1.default.post(url, {
                    userId,
                    name: sanitized,
                    receiverWalletAddress,
                    feeWalletAddress,
                    userToken,
                    source: modified
                });
                logger_1.logger.info(`Contract builder response status ${resp.status}`);
                return {
                    deployed: true,
                    contractAddress: resp.data?.contractAddress ?? null,
                    circleContractId: resp.data?.contractId ?? null,
                    raw: resp.data
                };
            }
            catch (err) {
                logger_1.logger.error('Failed to call external contract builder', err);
            }
        }
        // Attempt local compilation if solc is available
        try {
            // dynamic require to avoid hard dependency if not installed
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const solc = require('solc');
            const input = {
                language: 'Solidity',
                sources: {
                    'contract.sol': {
                        content: modified
                    }
                },
                settings: {
                    outputSelection: {
                        '*': {
                            '*': ['abi', 'evm.bytecode.object']
                        }
                    }
                }
            };
            logger_1.logger.info('Solc input sources keys:', Object.keys(input.sources));
            const output = JSON.parse(solc.compile(JSON.stringify(input)));
            logger_1.logger.info('Solc compile result keys:', Object.keys(output));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fatalErrors = output.errors?.filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (e) => e.severity === 'error');
            if (fatalErrors && fatalErrors.length > 0) {
                logger_1.logger.error('Solc compilation errors:', fatalErrors);
                return { deployed: false, raw: output };
            }
            if (output.errors) {
                logger_1.logger.warn('Solc compilation warnings:', output.errors);
            }
            const contracts = output.contracts?.['contract.sol'];
            const contractName = Object.keys(contracts || {})[0];
            if (!contractName) {
                logger_1.logger.error('No contract compiled');
                return { deployed: false, raw: output };
            }
            const artifact = contracts[contractName];
            const artifactsDir = path_1.default.join(repoRoot, 'src', 'services', 'contracts', 'artifacts');
            fs_1.default.mkdirSync(artifactsDir, { recursive: true });
            const artifactPath = path_1.default.join(artifactsDir, `${userId}_${sanitized}.json`);
            fs_1.default.writeFileSync(artifactPath, JSON.stringify({ abi: artifact.abi, bytecode: artifact.evm.bytecode.object }, null, 2));
            logger_1.logger.info(`Saved compiled artifact to ${artifactPath}`);
            // Attempt deployment via Circle
            try {
                const deployResp = await circleService_1.default.deployContract(artifact.evm.bytecode.object, sanitized, artifact.abi, userToken);
                logger_1.logger.info(`Contract deployed via Circle: ${deployResp.data?.contractAddress}`);
                return {
                    deployed: true,
                    contractAddress: deployResp.contractAddress,
                    artifactPath,
                    circleContractId: deployResp.data?.contractId || deployResp.contractId,
                    raw: { ...output, deployResp }
                };
            }
            catch (deployErr) {
                logger_1.logger.warn('Circle deployment failed, contract compiled but not deployed', deployErr);
                return { deployed: false, artifactPath, raw: output };
            }
        }
        catch (err) {
            logger_1.logger.warn('Local compilation skipped or failed; solc may be missing', err);
            return { deployed: false };
        }
    }
    catch (err) {
        logger_1.logger.error('createContractForUser failed', err);
        return { deployed: false };
    }
};
exports.createContractForUser = createContractForUser;
exports.default = exports.createContractForUser;
