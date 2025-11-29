import { ethers } from "hardhat";
import { Wallet } from "ethers";

// テスト用のダミーユーザー（秘密鍵付き - テストネット専用！）
// これらは公開されている秘密鍵なので、本番では絶対に使わないこと
const TEST_PRIVATE_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Account #0
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // Account #1
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Account #2
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // Account #3
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // Account #4
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", // Account #5
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e", // Account #6
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356", // Account #7
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97", // Account #8
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6", // Account #9
];

const CONTRACT_ADDRESS = "0xc5AeAeB37C3C96C443Cb0854124DaAd764C6D571";

async function main() {
  const provider = ethers.provider;
  const [deployer] = await ethers.getSigners();

  console.log("Registering test users on contract:", CONTRACT_ADDRESS);
  console.log("Network:", (await provider.getNetwork()).name);

  // コントラクトABIを取得
  const TrustlessLove = await ethers.getContractFactory("TrustlessLove");
  const contract = TrustlessLove.attach(CONTRACT_ADDRESS);

  // deployerから各テストアカウントにETHを送金してガス代を確保
  const fundAmount = ethers.parseEther("0.01");

  for (let i = 0; i < TEST_PRIVATE_KEYS.length; i++) {
    const wallet = new Wallet(TEST_PRIVATE_KEYS[i], provider);
    const address = wallet.address;

    // 既に登録済みかチェック
    const isRegistered = await contract.registered(address);
    if (isRegistered) {
      console.log(`[${i}] ${address} - Already registered ✓`);
      continue;
    }

    // ETH残高チェック
    const balance = await provider.getBalance(address);
    if (balance < fundAmount) {
      console.log(`[${i}] Funding ${address} with 0.01 ETH...`);
      const fundTx = await deployer.sendTransaction({
        to: address,
        value: fundAmount,
      });
      await fundTx.wait();
    }

    // 登録実行
    console.log(`[${i}] Registering ${address}...`);
    const contractWithSigner = contract.connect(wallet);
    const tx = await contractWithSigner.register();
    await tx.wait();
    console.log(`[${i}] ${address} - Registered ✓`);
  }

  console.log("\n=== Registered Test Users ===");
  for (let i = 0; i < TEST_PRIVATE_KEYS.length; i++) {
    const wallet = new Wallet(TEST_PRIVATE_KEYS[i], provider);
    console.log(`${i + 1}. ${wallet.address}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
