const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const price = process.env.PRICE_WEI_PER_30D || hre.ethers.parseEther("0.01").toString();
  const treasury = process.env.TREASURY;
  const operator = process.env.OPERATOR || (await hre.ethers.getSigners())[0].address;
  const grace = process.env.GRACE_SECONDS || (48 * 60 * 60).toString();

  if (!treasury) throw new Error("TREASURY is required");

  const LovepassGold = await hre.ethers.getContractFactory("LovepassGold");
  const c = await LovepassGold.deploy(price, treasury, operator, grace);
  await c.waitForDeployment();

  console.log("LovepassGold deployed to:", await c.getAddress());
  console.log("Params:", { price, treasury, operator, grace });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
