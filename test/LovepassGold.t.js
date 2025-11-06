const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LovepassGold", function () {
  const SECONDS_30D = 30 * 24 * 60 * 60;
  const GRACE = 48 * 60 * 60; // 48h

  async function deployFixture() {
    const [deployer, user, treasury, operator, other] = await ethers.getSigners();
    const price = ethers.parseEther("0.01");

    const LovepassGold = await ethers.getContractFactory("LovepassGold");
    const c = await LovepassGold.deploy(price, treasury.address, operator.address, GRACE);
    await c.waitForDeployment();
    return { c, deployer, user, treasury, operator, other, price };
  }

  it("New subscribe sets ~30d future and emits", async () => {
    const { c, user, price } = await deployFixture();
    const months = 1;
    const tx = await c.connect(user).subscribe(months, { value: price * BigInt(months) });
    const rc = await tx.wait();
    const ev = rc.logs.map(l => c.interface.parseLog(l)).find(e => e && e.name === 'Subscribed');
    expect(ev).to.exist;

    const [, expiry] = await Promise.all([
      Promise.resolve(),
      c.users(user.address)
    ]);
    const now = await ethers.provider.getBlock('latest').then(b => BigInt(b.timestamp));
    expect(expiry.expiry).to.be.greaterThanOrEqual(now);
    expect(expiry.expiry).to.be.closeTo(now + BigInt(SECONDS_30D), 5n);

    const active = await c.isActive(user.address);
    expect(active[0]).to.equal(true);
  });

  it("Renew stacks time", async () => {
    const { c, user, price } = await deployFixture();
    await c.connect(user).subscribe(1, { value: price });
    const before = (await c.users(user.address)).expiry;
    await c.connect(user).renew(1, { value: price });
    const after = (await c.users(user.address)).expiry;
    expect(after).to.equal(before + BigInt(SECONDS_30D));
  });

  it("Grant adds free time without ETH", async () => {
    const { c, user, deployer } = await deployFixture();
    const seconds = 7 * 24 * 60 * 60;
    await c.connect(deployer).grant(user.address, seconds, 1);
    const u = await c.users(user.address);
    expect(u.tier).to.equal(1);
    const now = BigInt((await ethers.provider.getBlock('latest')).timestamp);
    expect(u.expiry).to.be.closeTo(now + BigInt(seconds), 5n);
  });

  it("Revoke blocks isActive, unrevoke restores", async () => {
    const { c, user, deployer, price } = await deployFixture();
    await c.connect(user).subscribe(1, { value: price });
    let active = await c.isActive(user.address);
    expect(active[0]).to.equal(true);

    await c.connect(deployer).revoke(user.address, "abuse");
    active = await c.isActive(user.address);
    expect(active[0]).to.equal(false);

    await c.connect(deployer).unrevoke(user.address);
    active = await c.isActive(user.address);
    expect(active[0]).to.equal(true);
  });

  it("Price change affects new purchases only", async () => {
    const { c, user, deployer, price } = await deployFixture();
    await c.connect(user).subscribe(1, { value: price });
    await c.connect(deployer).setPriceWeiPer30d(price * 2n);
    await expect(c.connect(user).renew(1, { value: price }))
      .to.be.revertedWith("insufficient ETH");
  });

  it("Pause halts subscribe/renew, reads/admin still work", async () => {
    const { c, user, deployer, price } = await deployFixture();
    await c.connect(deployer).pause();
    await expect(c.connect(user).subscribe(1, { value: price })).to.be.revertedWithCustomError(c, 'EnforcedPause');
    await expect(c.connect(user).renew(1, { value: price })).to.be.revertedWithCustomError(c, 'EnforcedPause');

    // Admin revoke still works
    await expect(c.connect(deployer).revoke(user.address, "r")).to.emit(c, 'Revoked');
    // Read works
    const res = await c.isActive(user.address);
    expect(res[0]).to.equal(false);

    await c.connect(deployer).unpause();
    await expect(c.connect(user).subscribe(1, { value: price })).to.emit(c, 'Subscribed');
  });

  it("Withdraw moves balance to treasury", async () => {
    const { c, user, price, deployer, treasury } = await deployFixture();
    await c.connect(user).subscribe(2, { value: price * 2n });
    const balBefore = await ethers.provider.getBalance(treasury.address);
    const tx = await c.connect(deployer).withdraw();
    await tx.wait();
    const balAfter = await ethers.provider.getBalance(treasury.address);
    expect(balAfter).to.be.greaterThan(balBefore);
  });
});
