import Web3 from 'web3';
import { AbiItem } from 'web3-utils';

// Define types
interface Config {
  rpcUrl: string;
  usdcAddress: string;
  contractAddresses: string[];
  processHistoricalTransfers: boolean;
  minSplitAmount: number;
}

interface TransferEvent {
  returnValues: {
    from: string;
    to: string;
    value: string;
  };
  transactionHash: string;
  [key: string]: any; // For other event properties
}

interface CircleService {
  executeSplit(amount: number, to: string): Promise<any>;
}

interface SplitResult {
  transactionId: string;
  [key: string]: any;
}

interface USDCContract {
  methods: {
    balanceOf(address: string): { call(): Promise<string> };
  };
  getPastEvents(
    event: string,
    options: {
      filter?: { to?: string[] };
      fromBlock: number;
      toBlock: number;
    }
  ): Promise<TransferEvent[]>;
  events: any;
}

class USDCWatcher {
  private config: Config;
  private circleService: CircleService;
  private web3: Web3;
  private usdcABI: AbiItem[];
  private usdcContract: USDCContract;

  // State
  private isRunning: boolean;
  private interval: NodeJS.Timeout | null;
  private lastBlock: number;
  private eventsDetected: number;
  private splitsExecuted: number;
  private lastChecked: string | null;

  constructor(config: Config, circleService: CircleService) {
    this.config = config;
    this.circleService = circleService;
    this.web3 = new Web3(config.rpcUrl);

    // USDC Contract ABI (Transfer event and balanceOf)
    this.usdcABI = [
      {
        constant: true,
        inputs: [{ name: '_owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: 'balance', type: 'uint256' }],
        type: 'function'
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, name: 'from', type: 'address' },
          { indexed: true, name: 'to', type: 'address' },
          { indexed: false, name: 'value', type: 'uint256' }
        ],
        name: 'Transfer',
        type: 'event'
      }
    ] as AbiItem[];

    this.usdcContract = new this.web3.eth.Contract(
      this.usdcABI,
      config.usdcAddress
    ) as unknown as USDCContract;

    // State
    this.isRunning = false;
    this.interval = null;
    this.lastBlock = 0;
    this.eventsDetected = 0;
    this.splitsExecuted = 0;
    this.lastChecked = null;

    console.log(
      `👀 USDC Watcher initialized for ${config.contractAddresses.length} contracts`
    );
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Watcher already running');
      return;
    }

    try {
      // Get current block
      const currentBlock = await this.web3.eth.getBlockNumber();

      // Determine starting block based on historical processing setting
      if (this.config.processHistoricalTransfers) {
        // Process last 24 hours for catch-up, then monitor new transfers
        const blocksPer24h = Math.floor((24 * 60 * 60) / 12); // 7200
        this.lastBlock = Math.max(0, Number(currentBlock) - blocksPer24h); // Convert BigInt to number
        console.log(
          `📊 Starting from block: ${this.lastBlock} (catch-up last 24h + new transfers)`
        );
      } else {
        // Only monitor new transfers
        this.lastBlock = Number(currentBlock); // Convert BigInt to number
        console.log(
          `📊 Starting from block: ${this.lastBlock} (monitoring new transfers only)`
        );
      }

      // Start checking every 60 seconds to reduce load
      this.interval = setInterval(() => this.checkForTransfers(), 60000);
      this.isRunning = true;

      // Initial check
      await this.checkForTransfers();

      console.log('✅ USDC Watcher started successfully');
    } catch (error: any) {
      console.error('❌ Failed to start watcher:', error);
      throw error;
    }
  }

  private async checkForTransfers(): Promise<void> {
    try {
      const currentBlock = await this.web3.eth.getBlockNumber();

      // Only check if new blocks exist
      if (currentBlock <= this.lastBlock) {
        return;
      }

      // Process blocks in chunks to avoid query limits
      const chunkSize = 1000; // Process 1000 blocks at a time
      let fromBlock = this.lastBlock + 1;
      let allEvents: TransferEvent[] = [];

      while (fromBlock <= currentBlock) {
        const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);

        console.log(
          `🔍 Checking blocks ${fromBlock} to ${toBlock} (${allEvents.length} events so far)`
        );

        // Get Transfer events to YOUR contracts for this chunk
        const events = await this.usdcContract.getPastEvents('Transfer', {
          filter: { to: this.config.contractAddresses },
          fromBlock: fromBlock,
          toBlock: toBlock
        });

        console.log('events tested', events);

        allEvents.push(...events);
        fromBlock = toBlock + 1;

        // Small delay between chunks to avoid rate limiting
        if (fromBlock <= currentBlock) {
          await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms delay
        }
      }

      console.log(`📨 Found ${allEvents.length} transfer(s) to your contracts`);

      // Process each event with delay to avoid rate limiting
      for (const event of allEvents) {
        await this.processTransfer(event);
        // Small delay between processing events
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second
      }

      // Update last block
      this.lastBlock = currentBlock;
      this.lastChecked = new Date().toISOString();
    } catch (error: any) {
      console.error('❌ Error checking transfers:', error.message);
    }
  }

  private async processTransfer(event: TransferEvent): Promise<void> {
    const { from, to, value } = event.returnValues;
    const amount = parseInt(value);
    const timestamp = new Date().toISOString();
    const transferId = `${event.transactionHash.slice(0, 10)}...${event.transactionHash.slice(-6)}`;

    this.eventsDetected++;

    console.log(`\n[${timestamp}] 🔔 TRANSFER DETECTED | ID: ${transferId}`);
    console.log(`   └─ From: ${from}`);
    console.log(`   └─ To: ${to} (Contract)`);
    console.log(`   └─ Amount: ${amount / 1000000} USDC (${amount} units)`);
    console.log(
      `   └─ TX: https://sepolia.etherscan.io/tx/${event.transactionHash}`
    );

    // Check if amount meets minimum
    if (amount < this.config.minSplitAmount) {
      console.log(
        `[${timestamp}] ⏭️ SKIPPED | ID: ${transferId} | Reason: Amount below minimum (${this.config.minSplitAmount} units)`
      );
      return;
    }

    // Check contract balance before executing split
    let balanceUSDC: number;
    try {
      const contractBalance = await this.usdcContract.methods
        .balanceOf(to)
        .call();
      balanceUSDC = parseInt(contractBalance);

      if (balanceUSDC < this.config.minSplitAmount) {
        console.log(
          `[${timestamp}] ⏭️ SKIPPED | ID: ${transferId} | Reason: Insufficient balance (${balanceUSDC / 1000000} USDC < ${this.config.minSplitAmount / 1000000} USDC)`
        );
        return;
      }

      console.log(
        `[${timestamp}] 💰 BALANCE CHECK | ID: ${transferId} | Contract has ${balanceUSDC / 1000000} USDC`
      );
    } catch (balanceError: any) {
      console.error(
        `[${timestamp}] ❌ BALANCE CHECK FAILED | ID: ${transferId} | Error:`,
        balanceError.message
      );
      return;
    }

    // Execute splitUSDC
    try {
      console.log(
        `[${timestamp}] 🚀 EXECUTING SPLIT | ID: ${transferId} | Processing ${amount / 1000000} USDC...`
      );

      const result: SplitResult = await this.circleService.executeSplit(
        amount,
        to
      );

      console.log(`[${timestamp}] ✅ SPLIT SUCCESS | ID: ${transferId}`);
      console.log(`   └─ Circle TX: ${result.transactionId}`);
      console.log(
        `   └─ Fee: 0.30 USDC → 0x2ae66ef71ec7c455939944b10782ce4Ec03c49c1`
      );
      console.log(
        `   └─ Receive: ${(amount - 300000) / 1000000} USDC → 0x105fe877e09F1eeEA65a2Cc407a9df5942E4737F`
      );

      this.splitsExecuted++;
    } catch (error: any) {
      console.error(
        `[${timestamp}] ❌ SPLIT FAILED | ID: ${transferId} | Error:`,
        error.message
      );
    }
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.isRunning = false;
    console.log('⏹️ USDC Watcher stopped');
  }

  // Getters for state
  getStats(): {
    isRunning: boolean;
    lastBlock: number;
    eventsDetected: number;
    splitsExecuted: number;
    lastChecked: string | null;
  } {
    return {
      isRunning: this.isRunning,
      lastBlock: this.lastBlock,
      eventsDetected: this.eventsDetected,
      splitsExecuted: this.splitsExecuted,
      lastChecked: this.lastChecked
    };
  }
}

export default USDCWatcher;
