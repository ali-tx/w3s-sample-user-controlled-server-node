import Web3 from 'web3';
import { logger } from '../../services/logging/logger';
import config from '../../config';
import { contractDAO } from '../db/dao/contractDAO';

const USDC_ADDRESS = config.USDC_ADDRESS;
const INFURA = config.INFURA_API_KEY;
const PROCESS_HISTORICAL = config.PROCESS_HISTORICAL_TRANSFERS;

let web3: Web3 | null = null;
let lastBlock: bigint = BigInt(0);

function initProvider() {
  const url = INFURA
    ? `https://sepolia.infura.io/v3/${INFURA}`
    : process.env.WEB3_PROVIDER_URL;
  logger.info(`USDCWatcher using RPC URL: ${url}`);
  web3 = new Web3(url as string);
}

async function pollTransfers() {
  if (!web3) return;
  try {
    const latest = await web3.eth.getBlockNumber();
    const fromBlock: bigint =
      PROCESS_HISTORICAL && lastBlock === BigInt(0)
        ? latest - BigInt(1000)
        : lastBlock + BigInt(1);
    if (fromBlock > latest) return;

    const transferTopic = web3.utils.sha3(
      'Transfer(address,address,uint256)'
    ) as string;
    const logs = await web3.eth.getPastLogs({
      address: USDC_ADDRESS as string,
      fromBlock,
      toBlock: latest,
      topics: [transferTopic]
    });

    if (logs && logs.length > 0) {
      logger.info(
        `Detected ${logs.length} USDC logs between ${fromBlock}-${latest}`
      );
      const contracts = await contractDAO.getContractsByUser('%');

      for (const l of logs) {
        const to = '0x' + (l as any).topics[2].slice(26);
        for (const c of contracts) {
          if (!c.contractAddress) continue;
          if (c.contractAddress.toLowerCase() === to.toLowerCase()) {
            logger.info(
              `Transfer to tracked contract ${c.contractId} (${c.contractAddress})`
            );
            // TODO: implement split execution
          }
        }
      }
    }
    lastBlock = latest;
  } catch (err) {
    logger.error('Error in pollTransfers', err as Error);
  }
}

let intervalId: NodeJS.Timeout | null = null;

export function start() {
  if (!config.START_USDC_WATCHER) {
    logger.info('USDCWatcher disabled by config');
    return;
  }
  initProvider();
  intervalId = setInterval(pollTransfers, 15 * 1000);
  logger.info('USDCWatcher started');
}

export function stop() {
  if (intervalId) clearInterval(intervalId);
}

export default { start, stop };
