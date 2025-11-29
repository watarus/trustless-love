import { ethers } from "hardhat";

async function main() {
  console.log("Deploying TrustlessLove (Zama fhEVM) contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const TrustlessLove = await ethers.getContractFactory("TrustlessLove");
  const trustlessLove = await TrustlessLove.deploy();

  await trustlessLove.waitForDeployment();

  const address = await trustlessLove.getAddress();
  console.log("TrustlessLove deployed to:", address);

  return address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
