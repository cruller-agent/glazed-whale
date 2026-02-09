#!/usr/bin/env node
/**
 * Check controller status and display current configuration
 */

const { ethers } = require("ethers");
const dotenv = require("dotenv");

dotenv.config();

const RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const CONTROLLER_ADDRESS = process.env.CONTROLLER_ADDRESS;

const CONTROLLER_ABI = [
  "function getMiningStatus() view returns (bool isEnabled, bool canMintNow, uint256 currentPrice, uint256 nextMintTime, uint256 ethBalance, uint256 currentEpochId)",
  "function config() view returns (uint256 maxPricePerToken, uint256 minProfitMargin, uint256 maxMintAmount, uint256 minMintAmount, bool autoMiningEnabled, uint256 cooldownPeriod, uint256 maxGasPrice)",
  "function checkProfitability() view returns (bool isProfitable, uint256 currentPrice, uint256 recommendedAmount)",
  "function lastMintTimestamp() view returns (uint256)",
  "function franchiserRig() view returns (address)",
];

async function main() {
  if (!CONTROLLER_ADDRESS) {
    console.error("❌ CONTROLLER_ADDRESS not set in .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const controller = new ethers.Contract(CONTROLLER_ADDRESS, CONTROLLER_ABI, provider);

  console.log("🐋 Glazed Whale Status Report\n");
  console.log(`📍 Controller: ${CONTROLLER_ADDRESS}`);

  try {
    // Get rig address
    const rigAddress = await controller.franchiserRig();
    console.log(`🎯 Franchiser Rig: ${rigAddress}\n`);

    // Get configuration
    const config = await controller.config();
    console.log("⚙️  Configuration:");
    console.log(`  Max Price: ${ethers.formatEther(config.maxPricePerToken)} ETH/token`);
    console.log(`  Min Profit: ${config.minProfitMargin / 100}%`);
    console.log(`  Mint Range: ${ethers.formatEther(config.minMintAmount)} - ${ethers.formatEther(config.maxMintAmount)} tokens`);
    console.log(`  Auto Mining: ${config.autoMiningEnabled ? "✅ ENABLED" : "❌ DISABLED"}`);
    console.log(`  Cooldown: ${config.cooldownPeriod}s`);
    console.log(`  Max Gas: ${config.maxGasPrice} gwei\n`);

    // Get mining status
    const status = await controller.getMiningStatus();
    console.log("📊 Mining Status:");
    console.log(`  Current Price: ${ethers.formatEther(status.currentPrice)} ETH/token`);
    console.log(`  Epoch: ${status.currentEpochId}`);
    console.log(`  ETH Balance: ${ethers.formatEther(status.ethBalance)} ETH`);
    console.log(`  Can Mint Now: ${status.canMintNow ? "✅ YES" : "❌ NO"}`);
    
    if (!status.canMintNow && status.nextMintTime > 0n) {
      const nextMint = new Date(Number(status.nextMintTime) * 1000);
      const now = new Date();
      const waitTime = Math.max(0, Math.floor((nextMint - now) / 1000));
      console.log(`  Next Mint: ${nextMint.toLocaleString()} (in ${waitTime}s)`);
    }
    console.log("");

    // Check profitability
    const [isProfitable, currentPrice, recommendedAmount] = await controller.checkProfitability();
    console.log("💰 Profitability:");
    console.log(`  Status: ${isProfitable ? "✅ PROFITABLE" : "❌ NOT PROFITABLE"}`);
    console.log(`  Current Price: ${ethers.formatEther(currentPrice)} ETH/token`);
    console.log(`  Recommended Mint: ${ethers.formatEther(recommendedAmount)} tokens\n`);

    // Calculate potential cost
    if (isProfitable && recommendedAmount > 0n) {
      const cost = (currentPrice * recommendedAmount) / ethers.parseEther("1");
      console.log(`💸 Next Mint Cost: ${ethers.formatEther(cost)} ETH`);
      
      if (status.ethBalance >= cost) {
        console.log(`✅ Sufficient balance for next mint\n`);
      } else {
        const needed = cost - status.ethBalance;
        console.log(`❌ Need ${ethers.formatEther(needed)} more ETH\n`);
      }
    }

    // Last mint info
    const lastMint = await controller.lastMintTimestamp();
    if (lastMint > 0n) {
      const lastMintDate = new Date(Number(lastMint) * 1000);
      const timeSince = Math.floor((Date.now() - lastMintDate.getTime()) / 1000);
      console.log(`🕒 Last Mint: ${lastMintDate.toLocaleString()} (${timeSince}s ago)`);
    } else {
      console.log(`🕒 Last Mint: Never`);
    }

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

main();
