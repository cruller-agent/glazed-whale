# Glazed Whale 🐋

Automated Franchiser token mining bot with smart contract controller. Monitors the Franchiser token (0x9310aF...31060) and executes profitable mining operations via an intermediary controller contract.

## 🏗️ Architecture

```
┌─────────────┐      monitors      ┌──────────────┐
│   Monitor   │ ───────────────────> │  Franchiser  │
│   Script    │                     │  Rig Token   │
└──────┬──────┘                     └──────────────┘
       │
       │ triggers when profitable
       ↓
┌─────────────────┐      calls      ┌──────────────┐
│   Controller    │ ───────────────> │  Franchiser  │
│ Smart Contract  │                  │  Rig Token   │
└─────────────────┘                  └──────────────┘
```

### Components

1. **FranchiserController.sol** - Smart contract that:
   - Holds ETH for mining operations
   - Stores all configuration parameters onchain
   - Implements role-based access control:
     - **Owner**: Can withdraw funds and update config
     - **Manager**: Can trigger mining operations
   - Enforces safety limits (price thresholds, cooldowns, gas limits)

2. **monitor.js** - Monitoring script that:
   - Continuously checks Franchiser token mining price
   - Evaluates profitability against configured thresholds
   - Triggers controller to mint when conditions are met
   - Provides real-time stats and logging

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- An Ethereum wallet with Base mainnet access
- ETH on Base for deployment and mining

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Configuration

Edit `.env` with your details:

```bash
# Owner wallet (for deployment & withdrawals)
PRIVATE_KEY=0x...
OWNER_ADDRESS=0x...

# Manager wallet (for automated mining)
MANAGER_PRIVATE_KEY=0x...
MANAGER_ADDRESS=0x...

# Mining parameters
MAX_PRICE_PER_TOKEN=1000000000000000    # 0.001 ETH max price
MIN_PROFIT_MARGIN=1000                   # 10% minimum profit
```

### Deployment

```bash
# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to Base mainnet
npm run deploy

# After deployment, add CONTROLLER_ADDRESS to .env
CONTROLLER_ADDRESS=0x...
```

### Fund the Controller

Send ETH to the deployed controller address to enable mining:

```bash
# From your owner wallet, send ETH
cast send $CONTROLLER_ADDRESS --value 0.1ether --rpc-url $BASE_RPC_URL --private-key $PRIVATE_KEY
```

### Start Monitoring

```bash
npm run monitor
```

The monitor will:
- Check profitability every 60 seconds (configurable)
- Execute mints when price is favorable
- Display real-time stats
- Log all operations

## 📋 Configuration Parameters

All parameters are stored in the smart contract and can be updated by the owner:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `maxPricePerToken` | Maximum price willing to pay per token | 0.001 ETH |
| `minProfitMargin` | Minimum profit margin (basis points) | 1000 (10%) |
| `maxMintAmount` | Maximum tokens per transaction | 100 tokens |
| `minMintAmount` | Minimum tokens per transaction | 1 token |
| `autoMiningEnabled` | Global enable/disable switch | true |
| `cooldownPeriod` | Minimum time between mints | 300s (5 min) |
| `maxGasPrice` | Maximum gas price to pay | 10 gwei |

### Updating Configuration

Use the `updateConfig` function (owner only):

```bash
# Example: Update max price to 0.002 ETH
cast send $CONTROLLER_ADDRESS "updateConfig(uint256,uint256,uint256,uint256,bool,uint256,uint256)" \
  2000000000000000 1000 100000000000000000000 1000000000000000000 true 300 10 \
  --rpc-url $BASE_RPC_URL --private-key $PRIVATE_KEY
```

## 🔐 Access Control

The contract implements role-based access:

### Owner Role
Can:
- Withdraw ETH and tokens
- Update configuration parameters
- Emergency stop mining
- Grant/revoke manager role

### Manager Role
Can:
- Execute mining operations
- Query profitability
- Check status

### Security Features
- ReentrancyGuard on all sensitive functions
- Role-based access control (OpenZeppelin)
- Configurable safety limits
- Emergency stop mechanism
- Event logging for all operations

## 💰 Economics

### Profitability Calculation

The monitor checks:
1. Current mining price from Franchiser Rig
2. Configured maximum price threshold
3. Cooldown period status
4. Gas price limits
5. Available ETH balance

Mining executes when:
```
currentPrice ≤ maxPricePerToken
AND cooldownPeriod elapsed
AND gasPrice ≤ maxGasPrice
AND sufficient ETH balance
```

### Cost Analysis

**Deployment:**
- Contract deployment: ~0.003 ETH
- Configuration: Stored onchain

**Operation:**
- Mining cost: Variable (depends on Franchiser epoch)
- Gas per mint: ~200k-300k gas
- Monitor: Negligible (read-only checks)

## 📊 Monitoring & Stats

The monitor displays:
- Current mining price and epoch
- Profitability status
- Successful mints
- Total tokens minted
- Total ETH spent
- Uptime and error count

Example output:
```
[2026-02-09T08:00:00.000Z] Check #42
  Price: 0.000876 ETH/token | Epoch: 5 | Balance: 0.5 ETH
  ✅ PROFITABLE! Executing mint...
  Amount: 100.0 tokens
  📝 Transaction submitted: 0xabc...
  ✅ MINT SUCCESSFUL!
  Tokens: 100.0 | Cost: 0.0876 ETH | Epoch: 5
```

## 🛠️ Advanced Usage

### Query Status

```bash
# Check mining status
cast call $CONTROLLER_ADDRESS "getMiningStatus()" --rpc-url $BASE_RPC_URL

# Check profitability
cast call $CONTROLLER_ADDRESS "checkProfitability()" --rpc-url $BASE_RPC_URL
```

### Manual Operations

```bash
# Trigger manual mint (manager only)
cast send $CONTROLLER_ADDRESS "executeMint(address,uint256)" \
  $RECIPIENT_ADDRESS 10000000000000000000 \
  --rpc-url $BASE_RPC_URL --private-key $MANAGER_PRIVATE_KEY

# Emergency stop (owner only)
cast send $CONTROLLER_ADDRESS "emergencyStop()" \
  --rpc-url $BASE_RPC_URL --private-key $PRIVATE_KEY

# Withdraw ETH (owner only)
cast send $CONTROLLER_ADDRESS "withdrawETH(address,uint256)" \
  $OWNER_ADDRESS 100000000000000000 \
  --rpc-url $BASE_RPC_URL --private-key $PRIVATE_KEY
```

### Run in Production

Use a process manager for 24/7 operation:

```bash
# With PM2
pm2 start scripts/monitor.js --name "glazed-whale"
pm2 save
pm2 startup

# With systemd
sudo cp glazed-whale.service /etc/systemd/system/
sudo systemctl enable glazed-whale
sudo systemctl start glazed-whale
```

## 🧪 Testing

```bash
# Run full test suite
npm test

# Run with coverage
npm run coverage

# Test on local fork
npx hardhat node --fork https://mainnet.base.org
npx hardhat run scripts/deploy.js --network localhost
```

## 🔍 Contract Verification

After deployment, verify on BaseScan:

```bash
npx hardhat verify --network base $CONTROLLER_ADDRESS \
  "0x9310aF2707c458F52e1c4D48749433454D731060" \
  $OWNER_ADDRESS \
  $MANAGER_ADDRESS \
  "1000000000000000" \
  "1000"
```

## 📚 Resources

- [Franchiser Documentation](https://github.com/cruller-agent/donutdao-app-scaffold/blob/main/contracts/donutdao-contracts/docs/FRANCHISE.md)
- [DonutDAO Ecosystem](https://donutdao.com)
- [Base Network](https://base.org)

## ⚠️ Disclaimer

This software is provided as-is. Always test thoroughly before deploying to mainnet. Monitor gas prices and market conditions. Never invest more than you can afford to lose.

## 📝 License

MIT

---

Built with ❤️ by Cruller for the DonutDAO ecosystem
