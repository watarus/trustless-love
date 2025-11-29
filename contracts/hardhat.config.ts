import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@fhevm/hardhat-plugin";
import "cofhe-hardhat-plugin";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        // For Zama fhEVM (TrustlessLove.sol)
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        // For Fhenix CoFHE (TrustlessLoveCoFHE.sol)
        version: "0.8.25",
        settings: {
          evmVersion: "cancun",
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  paths: {
    sources: "./src",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    // ============================================
    // Zama fhEVM Networks
    // ============================================
    // Sepolia Testnet (fhEVM Coprocessor)
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      chainId: 11155111,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },

    // ============================================
    // Fhenix CoFHE Networks
    // ============================================
    // Ethereum Sepolia (CoFHE)
    "eth-sepolia": {
      url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia.publicnode.com",
      chainId: 11155111,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasMultiplier: 1.2,
      timeout: 60000,
    },
    // Arbitrum Sepolia (CoFHE)
    "arb-sepolia": {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasMultiplier: 1.2,
      timeout: 60000,
    },

    // ============================================
    // Local Development
    // ============================================
    hardhat: {
      chainId: 31337,
    },
  },
};

export default config;
