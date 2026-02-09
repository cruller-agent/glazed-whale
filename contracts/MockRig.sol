// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockRig
 * @notice Mock Rig contract for testing
 */
contract MockRig {
    uint256 private _currentPrice = 0.0005 ether;
    uint256 private _epochId = 1;

    function mint(address to, uint256 amount) external payable {
        require(msg.value >= quote(amount), "Insufficient payment");
        // Mock mint - just accept ETH
    }

    function quotePrice() external view returns (uint256) {
        return _currentPrice;
    }

    function quote(uint256 amount) public view returns (uint256) {
        return (_currentPrice * amount) / 1e18;
    }

    function currentEpochId() external view returns (uint256) {
        return _epochId;
    }

    // Test helpers
    function setPrice(uint256 newPrice) external {
        _currentPrice = newPrice;
    }

    function setEpoch(uint256 newEpoch) external {
        _epochId = newEpoch;
    }
}
