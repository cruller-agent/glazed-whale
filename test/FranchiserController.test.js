const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FranchiserController", function () {
  let controller;
  let mockRig;
  let owner;
  let manager;
  let user;

  const MAX_PRICE = ethers.parseEther("0.001");
  const MIN_MARGIN = 1000; // 10%

  beforeEach(async function () {
    [owner, manager, user] = await ethers.getSigners();

    // Deploy mock Rig
    const MockRig = await ethers.getContractFactory("MockRig");
    mockRig = await MockRig.deploy();

    // Deploy controller
    const FranchiserController = await ethers.getContractFactory("FranchiserController");
    controller = await FranchiserController.deploy(
      await mockRig.getAddress(),
      owner.address,
      manager.address,
      MAX_PRICE,
      MIN_MARGIN
    );
  });

  describe("Deployment", function () {
    it("Should set the correct roles", async function () {
      const OWNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OWNER_ROLE"));
      const MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"));

      expect(await controller.hasRole(OWNER_ROLE, owner.address)).to.be.true;
      expect(await controller.hasRole(MANAGER_ROLE, manager.address)).to.be.true;
    });

    it("Should initialize config correctly", async function () {
      const config = await controller.config();
      expect(config.maxPricePerToken).to.equal(MAX_PRICE);
      expect(config.minProfitMargin).to.equal(MIN_MARGIN);
      expect(config.autoMiningEnabled).to.be.true;
    });
  });

  describe("Mining Operations", function () {
    it("Should check profitability", async function () {
      const [isProfitable, currentPrice, recommendedAmount] = await controller.checkProfitability();
      expect(currentPrice).to.equal(ethers.parseEther("0.0005")); // Mock price
      expect(isProfitable).to.be.true;
      expect(recommendedAmount).to.be.gt(0);
    });

    it("Should execute mint when profitable", async function () {
      // Fund controller
      await owner.sendTransaction({
        to: await controller.getAddress(),
        value: ethers.parseEther("1"),
      });

      const amount = ethers.parseEther("10");
      await expect(controller.connect(manager).executeMint(user.address, amount))
        .to.emit(controller, "TokensMinted")
        .withArgs(user.address, amount, await mockRig.quote(amount), 1n);
    });

    it("Should reject mint from non-manager", async function () {
      const amount = ethers.parseEther("10");
      await expect(
        controller.connect(user).executeMint(user.address, amount)
      ).to.be.reverted;
    });
  });

  describe("Configuration", function () {
    it("Should update config (owner only)", async function () {
      const newMaxPrice = ethers.parseEther("0.002");
      await expect(
        controller.updateConfig(
          newMaxPrice,
          2000,
          ethers.parseEther("200"),
          ethers.parseEther("2"),
          true,
          600,
          20
        )
      ).to.emit(controller, "ConfigUpdated");

      const config = await controller.config();
      expect(config.maxPricePerToken).to.equal(newMaxPrice);
    });

    it("Should reject config update from non-owner", async function () {
      await expect(
        controller.connect(manager).updateConfig(
          MAX_PRICE,
          MIN_MARGIN,
          ethers.parseEther("100"),
          ethers.parseEther("1"),
          true,
          300,
          10
        )
      ).to.be.reverted;
    });
  });

  describe("Withdrawals", function () {
    beforeEach(async function () {
      // Fund controller
      await owner.sendTransaction({
        to: await controller.getAddress(),
        value: ethers.parseEther("1"),
      });
    });

    it("Should withdraw ETH (owner only)", async function () {
      const amount = ethers.parseEther("0.5");
      await expect(controller.withdrawETH(owner.address, amount))
        .to.emit(controller, "ETHWithdrawn")
        .withArgs(owner.address, amount);
    });

    it("Should reject ETH withdrawal from non-owner", async function () {
      await expect(
        controller.connect(manager).withdrawETH(manager.address, ethers.parseEther("0.5"))
      ).to.be.reverted;
    });
  });

  describe("Status Queries", function () {
    it("Should return mining status", async function () {
      const status = await controller.getMiningStatus();
      expect(status.isEnabled).to.be.true;
      expect(status.currentPrice).to.be.gt(0);
    });
  });
});

// Mock Rig contract for testing
describe("MockRig", function () {
  async function deployMockRig() {
    const MockRig = await ethers.getContractFactory("MockRig");
    return await MockRig.deploy();
  }

  it("Should deploy", async function () {
    const mockRig = await deployMockRig();
    expect(await mockRig.getAddress()).to.be.properAddress;
  });
});
