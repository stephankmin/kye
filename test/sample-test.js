const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { waffle } = require("hardhat");
const { ethers } = require("hardhat");


describe("Kye", () => {
  let kyeContract;
  let deployer;
  let accounts;
  let user1;
  const depositAmount = ethers.utils.parseEther("1.0");
  
  before(async () => {
    accounts = await ethers.getSigners();
    deployer = accounts[0];
    user1 = accounts[1];
    kyeContract = await ethers.getContractFactory("Kye");
    kye = await kyeContract.deploy(7,10);
    await kye.deployed();
  });

  it("Should return depositAmount passed into constructor", async function () {
    expect(await kye.depositAmount()).to.equal(ethers.utils.parseEther("1.0"));
  });

  it("Should return depositPeriod passed into constructor", async function () {
    expect(await kye.depositPeriod()).to.equal(7);
  });

  it("Should add user address to users mapping", async function () {
    await (await kye.addUser(user1.address)).wait();
    
    const exampleUser = await kye.users(user1.address);
    expect(exampleUser['isUser']).to.equal(true);

  });

  it("Should start Kye and allow deposits to be made", async function () {
    await (await kye.startKye()).wait();

    expect(await kye.isActive()).to.equal(true);
  });

  it("Should make new deposit with user1's address", async function () {
    const newDeposit = await kye.connect(user1).deposit({ value: depositAmount });
    const newUser = await kye.users(user1.address);

    expect(await kye.totalPool()).to.equal(depositAmount);
    expect(newUser['hasDeposited']).to.equal(true);
    expect(await kye.orderOfDeposits(0)).to.equal(user1.address);
    expect(newDeposit)
      .to.emit(kye, 'Deposit')
      .withArgs(user1.address, depositAmount);
  });

  it("Should distribute pool once all users have deposited and depositPeriod has passed since last distribution", async function () {    
    for(const a of accounts.slice(2,11)) {
      await (await kye.addUser(a.address)).wait();
      const deposit = await kye.connect(a).deposit({ value: depositAmount });
      const userStruct = await kye.users(a.address);
      expect(userStruct['hasDeposited']).to.equal(true);
      expect(deposit)
        .to.emit(kye, 'Deposit')
        .withArgs(a.address, depositAmount);
    }

    expect(await kye.readyToDistribute()).to.equal(true);
    const distribution = await kye.connect(deployer).distributePool();
    const user1Struct = await kye.users(user1.address); 
    expect(user1Struct['hasWon']).to.equal(true);
    expect(distribution)
      .to.emit(kye, 'DistributePool')
      .withArgs(user1.address, BigNumber.from("10").pow(19));
  });
});