import { ethers } from "hardhat";

async function main() {
  const networkName = (await ethers.provider.getNetwork()).name;
  console.log(`Deploying TrustlessLoveCoFHE (Fhenix CoFHE) to ${networkName}...`);

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const TrustlessLove = await ethers.getContractFactory("TrustlessLoveCoFHE");
  const contract = await TrustlessLove.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("TrustlessLoveCoFHE deployed to:", address);

  // Register deployer for testing
  console.log("Registering deployer...");
  const tx = await contract.register();
  await tx.wait();
  console.log("Deployer registered!");

  console.log("\n=== Deployment Complete ===");
  console.log("Contract:", address);
  console.log("Network:", networkName);
  console.log("\nUpdate CONTRACT_ADDRESS in your frontend configuration.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
