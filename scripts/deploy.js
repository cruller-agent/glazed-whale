#!/usr/bin/env node
/**
 * Deploy FranchiserController contract
 */

const hre = require("hardhat");
const dotenv = require("dotenv");

dotenv.config();

// Configuration
const FRANCHISER_RIG = process.env.FRANCHISER_RIG || "0x9310aF2707c458F52e1c4D48749433454D731060";
const OWNER_ADDRESS = process.env.OWNER_ADDRESS;
const MANAGER_ADDRESS = process.env.MANAGER_ADDRESS;
const MAX_PRICE_PER_TOKEN = process.env.MAX_PRICE_PER_TOKEN || hre.ethers.parseEther("0.001"); // 0.001 ETH default
const MIN_PROFIT_MARGIN = process.env.MIN_PROFIT_MARGIN || "1000"; // 10% default

async function main() {
  console.log("🚀 Deploying FranchiserController...\n");

  // Validate inputs
  if (!OWNER_ADDRESS) {
    throw new Error("OWNER_ADDRESS not set");
  }
  if (!MANAGER_ADDRESS) {
    throw new Error("MANAGER_ADDRESS not set");
  }

  console.log("📋 Configuration:");
  console.log(`  Franchiser Rig: ${FRANCHISER_RIG}`);
  console.log(`  Owner: ${OWNER_ADDRESS}`);
  console.log(`  Manager: ${MANAGER_ADDRESS}`);
  console.log(`  Max Price: ${hre.ethers.formatEther(MAX_PRICE_PER_TOKEN)} ETH/token`);
  console.log(`  Min Profit: ${MIN_PROFIT_MARGIN / 100}%\n`);

  // Deploy
  const FranchiserController = await hre.ethers.getContractFactory("FranchiserController");
  const controller = await FranchiserController.deploy(
    FRANCHISER_RIG,
    OWNER_ADDRESS,
    MANAGER_ADDRESS,
    MAX_PRICE_PER_TOKEN,
    MIN_PROFIT_MARGIN
  );

  await controller.waitForDeployment();
  const address = await controller.getAddress();

  console.log("✅ FranchiserController deployed!");
  console.log(`  Address: ${address}`);
  console.log(`  Transaction: ${controller.deploymentTransaction().hash}\n`);

  // Display setup instructions
  console.log("📝 Next Steps:");
  console.log(`  1. Add CONTROLLER_ADDRESS=${address} to your .env file`);
  console.log(`  2. Fund the controller with ETH: send ETH to ${address}`);
  console.log(`  3. Start the monitor: npm run monitor`);
  console.log(`  4. View on BaseScan: https://basescan.org/address/${address}\n`);

  // Verify on BaseScan (if API key provided)
  if (process.env.BASESCAN_API_KEY) {
    console.log("⏳ Waiting 30s before verification...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    try {
      console.log("🔍 Verifying contract on BaseScan...");
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: [
          FRANCHISER_RIG,
          OWNER_ADDRESS,
          MANAGER_ADDRESS,
          MAX_PRICE_PER_TOKEN,
          MIN_PROFIT_MARGIN,
        ],
      });
      console.log("✅ Contract verified!");
    } catch (error) {
      console.log("⚠️  Verification failed (may already be verified):", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
