#!/usr/bin/env node
/**
 * Franchiser Mining Monitor
 * Continuously monitors the Franchiser token and executes mining when profitable
 */

const { ethers } = require("ethers");
const dotenv = require("dotenv");

dotenv.config();

// Configuration
const RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const PRIVATE_KEY = process.env.MANAGER_PRIVATE_KEY;
const CONTROLLER_ADDRESS = process.env.CONTROLLER_ADDRESS;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || "60000"); // 1 minute default
const RECIPIENT_ADDRESS = process.env.RECIPIENT_ADDRESS || process.env.OWNER_ADDRESS;

// Contract ABIs (minimal)
const CONTROLLER_ABI = [
  "function checkProfitability() view returns (bool isProfitable, uint256 currentPrice, uint256 recommendedAmount)",
  "function executeMint(address recipient, uint256 amount) external",
  "function getMiningStatus() view returns (bool isEnabled, bool canMintNow, uint256 currentPrice, uint256 nextMintTime, uint256 ethBalance, uint256 currentEpochId)",
  "function config() view returns (uint256 maxPricePerToken, uint256 minProfitMargin, uint256 maxMintAmount, uint256 minMintAmount, bool autoMiningEnabled, uint256 cooldownPeriod, uint256 maxGasPrice)",
  "event TokensMinted(address indexed recipient, uint256 amount, uint256 cost, uint256 epochId)"
];

// State
let provider;
let wallet;
let controller;
let isRunning = false;
let stats = {
  startTime: Date.now(),
  checksPerformed: 0,
  mintsExecuted: 0,
  totalTokensMinted: 0,
  totalETHSpent: 0,
  errors: 0,
  lastMintTime: null,
};

/**
 * Initialize connection
 */
async function initialize() {
  console.log("🔧 Initializing Franchiser Mining Monitor...");
  
  if (!PRIVATE_KEY) {
    throw new Error("MANAGER_PRIVATE_KEY not set in environment");
  }
  
  if (!CONTROLLER_ADDRESS) {
    throw new Error("CONTROLLER_ADDRESS not set in environment");
  }

  // Connect to Base
  provider = new ethers.JsonRpcProvider(RPC_URL);
  wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  controller = new ethers.Contract(CONTROLLER_ADDRESS, CONTROLLER_ABI, wallet);

  // Verify connection
  const network = await provider.getNetwork();
  console.log(`✅ Connected to ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`📍 Controller: ${CONTROLLER_ADDRESS}`);
  console.log(`👤 Manager: ${wallet.address}`);
  console.log(`🎯 Recipient: ${RECIPIENT_ADDRESS}`);
  
  // Display config
  await displayConfig();
  
  console.log("\n🚀 Monitor starting...\n");
}

/**
 * Display current configuration
 */
async function displayConfig() {
  try {
    const config = await controller.config();
    const status = await controller.getMiningStatus();
    
    console.log("\n📋 Current Configuration:");
    console.log(`  Max Price Per Token: ${ethers.formatEther(config.maxPricePerToken)} ETH`);
    console.log(`  Min Profit Margin: ${config.minProfitMargin / 100}%`);
    console.log(`  Mint Range: ${ethers.formatEther(config.minMintAmount)} - ${ethers.formatEther(config.maxMintAmount)} tokens`);
    console.log(`  Auto Mining: ${config.autoMiningEnabled ? "✅ ENABLED" : "❌ DISABLED"}`);
    console.log(`  Cooldown: ${config.cooldownPeriod}s`);
    console.log(`  Max Gas: ${config.maxGasPrice} gwei`);
    console.log(`  Controller Balance: ${ethers.formatEther(status.ethBalance)} ETH`);
    console.log(`  Current Epoch: ${status.currentEpochId}`);
  } catch (error) {
    console.error("❌ Failed to fetch config:", error.message);
  }
}

/**
 * Check profitability and execute if favorable
 */
async function checkAndMine() {
  try {
    stats.checksPerformed++;
    
    // Get mining status
    const status = await controller.getMiningStatus();
    
    if (!status.isEnabled) {
      console.log("⏸️  Auto mining disabled");
      return;
    }

    // Check profitability
    const [isProfitable, currentPrice, recommendedAmount] = await controller.checkProfitability();
    
    const priceETH = ethers.formatEther(currentPrice);
    const timestamp = new Date().toISOString();
    
    console.log(`[${timestamp}] Check #${stats.checksPerformed}`);
    console.log(`  Price: ${priceETH} ETH/token | Epoch: ${status.currentEpochId} | Balance: ${ethers.formatEther(status.ethBalance)} ETH`);
    
    if (!status.canMintNow) {
      const nextMint = new Date(Number(status.nextMintTime) * 1000);
      console.log(`  ⏳ Cooldown active. Next mint available: ${nextMint.toLocaleTimeString()}`);
      return;
    }

    if (!isProfitable || recommendedAmount === 0n) {
      console.log(`  ⛔ Not profitable at current price`);
      return;
    }

    // Execute mint
    console.log(`  ✅ PROFITABLE! Executing mint...`);
    console.log(`  Amount: ${ethers.formatEther(recommendedAmount)} tokens`);
    
    const tx = await controller.executeMint(RECIPIENT_ADDRESS, recommendedAmount, {
      gasLimit: 500000, // Safety limit
    });
    
    console.log(`  📝 Transaction submitted: ${tx.hash}`);
    console.log(`  ⏳ Waiting for confirmation...`);
    
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      // Parse event
      const event = receipt.logs
        .map(log => {
          try {
            return controller.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find(e => e && e.name === "TokensMinted");
      
      if (event) {
        const amount = ethers.formatEther(event.args.amount);
        const cost = ethers.formatEther(event.args.cost);
        const epochId = event.args.epochId.toString();
        
        stats.mintsExecuted++;
        stats.totalTokensMinted += parseFloat(amount);
        stats.totalETHSpent += parseFloat(cost);
        stats.lastMintTime = new Date();
        
        console.log(`  ✅ MINT SUCCESSFUL!`);
        console.log(`  Tokens: ${amount} | Cost: ${cost} ETH | Epoch: ${epochId}`);
        console.log(`  TX: https://basescan.org/tx/${receipt.hash}`);
      }
    } else {
      console.log(`  ❌ Transaction failed`);
      stats.errors++;
    }
    
  } catch (error) {
    stats.errors++;
    
    if (error.message.includes("Auto mining disabled")) {
      console.log("⏸️  Auto mining disabled");
    } else if (error.message.includes("Cooldown active")) {
      console.log("⏳ Cooldown active, waiting...");
    } else if (error.message.includes("Price too high")) {
      console.log("⛔ Price too high, waiting for better opportunity...");
    } else if (error.message.includes("Insufficient ETH balance")) {
      console.log("❌ Insufficient ETH in controller. Please fund the contract!");
    } else {
      console.error(`❌ Error during check: ${error.message}`);
    }
  }
}

/**
 * Display statistics
 */
function displayStats() {
  const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;
  
  console.log("\n📊 Statistics:");
  console.log(`  Uptime: ${hours}h ${minutes}m ${seconds}s`);
  console.log(`  Checks: ${stats.checksPerformed}`);
  console.log(`  Mints: ${stats.mintsExecuted}`);
  console.log(`  Tokens Minted: ${stats.totalTokensMinted.toFixed(2)}`);
  console.log(`  ETH Spent: ${stats.totalETHSpent.toFixed(4)} ETH`);
  console.log(`  Errors: ${stats.errors}`);
  if (stats.lastMintTime) {
    console.log(`  Last Mint: ${stats.lastMintTime.toLocaleString()}`);
  }
  console.log("");
}

/**
 * Main monitoring loop
 */
async function run() {
  await initialize();
  
  isRunning = true;
  
  // Display stats every 10 checks
  let checkCounter = 0;
  
  while (isRunning) {
    await checkAndMine();
    
    checkCounter++;
    if (checkCounter >= 10) {
      displayStats();
      checkCounter = 0;
    }
    
    // Wait for next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

/**
 * Graceful shutdown
 */
function shutdown() {
  console.log("\n\n🛑 Shutting down...");
  isRunning = false;
  displayStats();
  console.log("👋 Goodbye!");
  process.exit(0);
}

// Handle signals
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Handle errors
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled error:", error);
  stats.errors++;
});

// Start
if (require.main === module) {
  run().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { run, stats };
