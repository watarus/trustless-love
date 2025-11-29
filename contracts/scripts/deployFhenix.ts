import { ethers } from "hardhat";

async function main() {
  console.log("Deploying TrustlessLoveFhenix to Fhenix Helium...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "FHE");

  const TrustlessLove = await ethers.getContractFactory("TrustlessLoveFhenix");
  const contract = await TrustlessLove.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("TrustlessLoveFhenix deployed to:", address);

  // Register deployer for testing
  console.log("Registering deployer...");
  const tx = await contract.register();
  await tx.wait();
  console.log("Deployer registered!");

  console.log("\n=== Deployment Complete ===");
  console.log("Contract:", address);
  console.log("Network: Fhenix Helium (chainId: 8008135)");
  console.log("\nUpdate CONTRACT_ADDRESS in src/app/page.tsx");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
