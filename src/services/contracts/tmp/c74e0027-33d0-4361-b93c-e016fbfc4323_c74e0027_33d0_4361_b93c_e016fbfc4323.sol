// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract c74e0027_33d0_4361_b93c_e016fbfc4323 {
    // SEPOLIA USDC ADDRESS - HARDCODED
    address private constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

    // YOUR WALLETS - HARDCODED WITH CHECKSUMS
    address private constant RECEIVE_WALLET = 0xDd05B75348AD208b590977A1bF1bC1287034e846;
    address private constant FEE_WALLET = 0x1872b9d360e96a3e563c66a1a3565cbec8911adc;

    // 30 CENTS IN USDC UNITS (6 decimals)
    uint256 private constant FEE_AMOUNT = 300000; // 0.30 USDC

    event USDCSplit(
        address indexed sender,
        uint256 amount,
        uint256 fee,
        uint256 received
    );

    // NO CONSTRUCTOR - everything hardcoded
    constructor() {
        // Nothing to initialize
    }
    
    // SINGLE FUNCTION: Split USDC
    function splitUSDC(uint256 amount) external returns (bool) {
        // Check the CONTRACT's balance first
        uint256 contractBalance = _balanceOf(address(this));
        require(contractBalance >= amount, "Contract has insufficient USDC");
        
        // Must send more than 0.30 USDC
        require(amount > FEE_AMOUNT, "Send more than 0.30 USDC");
        
        // Calculate remaining after fee
        uint256 remaining = amount - FEE_AMOUNT;
        
        // Send 30 cent fee FROM THE CONTRACT
        bool success = _transfer(FEE_WALLET, FEE_AMOUNT);
        require(success, "Fee transfer failed");
        
        // Send remainder to receiver FROM THE CONTRACT
        success = _transfer(RECEIVE_WALLET, remaining);
        require(success, "Remainder transfer failed");
        
        emit USDCSplit(msg.sender, amount, FEE_AMOUNT, remaining);
        return true;
    }
    
    // INTERNAL: Transfer USDC (no interface)
    function _transfer(address to, uint256 amount) private returns (bool) {
        (bool success, ) = SEPOLIA_USDC.call(
            abi.encodeWithSignature(
                "transfer(address,uint256)",
                to,
                amount
            )
        );
        return success;
    }
    
    // Emergency: Recover any stuck USDC (only RECEIVE_WALLET can call)
    function recoverUSDC() external {
        require(msg.sender == RECEIVE_WALLET, "Not authorized");
        uint256 balance = _balanceOf(address(this));
        if (balance > 0) {
            _transfer(RECEIVE_WALLET, balance);
        }
    }
    
    // Check USDC balance
    function getUSDCBalance() external view returns (uint256) {
        return _balanceOf(address(this));
    }
    
    // INTERNAL: Get USDC balance (no interface)
    function _balanceOf(address account) private view returns (uint256) {
        (bool success, bytes memory data) = SEPOLIA_USDC.staticcall(
            abi.encodeWithSignature("balanceOf(address)", account)
        );
        require(success, "Balance check failed");
        return abi.decode(data, (uint256));
    }
    
    // View constants
    function getFeeAmount() external pure returns (uint256) {
        return FEE_AMOUNT;
    }
    
    function getUSDCAddress() external pure returns (address) {
        return SEPOLIA_USDC;
    }
    
    function getReceiveWallet() external pure returns (address) {
        return RECEIVE_WALLET;
    }

    function getFeeWallet() external pure returns (address) {
        return FEE_WALLET;
    }
}