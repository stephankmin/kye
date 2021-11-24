const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("Kye", () => {
  let kyeContract;
  let kye;
  let kyeDeployed;
  let deployer;
  let accounts;
  let user1;
  let depositAmount;

  before(async () => {
    accounts = await ethers.getSigners();
    deployer = accounts[0];
    user1 = accounts[1];
    kyeContract = await ethers.getContractFactory("Kye");
    depositAmount = ethers.utils.parseEther("1.0");
  });

  describe("constructor", () => {
    before(async () => {
      kye = await kyeContract.deploy(ethers.utils.parseEther("1.0"),7,10);
      kyeDeployed = await kye.deployed();
    });

    it("should return depositAmount passed into constructor", async function () {
      expect(await kyeDeployed.depositAmount()).to.equal(ethers.utils.parseEther("1.0"));
    });
  
    it("should return lengthOfRound passed into constructor", async function () {
      expect(await kyeDeployed.lengthOfRound()).to.equal(7);
    });

    it("should return requiredNumberOfUsers passed into constructor", async function () {
      expect(await kyeDeployed.requiredNumberOfUsers()).to.equal(10);
    });
  });

  describe("startKye()", () => {
    before(async () => {
      kye = await kyeContract.deploy(ethers.utils.parseEther("1.0"),7,10);
      kyeDeployed = await kye.deployed();
    });

    it("should be reverted if called by non-owner", async function () {
      await expect(kyeDeployed.connect(user1).startKye())
        .to.be.revertedWith("Only the contract owner can call this function");
    });

    it("should set isActive to true", async function () {
      await (await kyeDeployed.startKye()).wait();
      expect(await kyeDeployed.isActive()).to.equal(true);
    });

    it("should set firstRoundInProgress to true", async function () {
      expect(await kye.firstRoundInProgress()).to.equal(true);
    });

    it("should set lastDistribution to the current block timestamp", async function () {
      const blockNum = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNum);
      const timestamp = block.timestamp;

      expect(await kyeDeployed.lastDistribution()).to.equal(timestamp);
    });
  }); 

  describe("addUser()", () => {
    before(async () => {
      kye = await kyeContract.deploy(ethers.utils.parseEther("1.0"),7,10);
      kyeDeployed = await kye.deployed();
    });

    it("should be reverted if isActive is false", async function () {
      await expect(kyeDeployed.addUser(user1.address))
        .to.be.revertedWith("Kye has not started yet");
    });

    it("should be reverted if called by non-owner", async function () {
      const startTxn = await kye.startKye();
      const startTxnComplete = await startTxn.wait();

      const newUser = accounts[2];
      await expect(kyeDeployed.connect(user1).addUser(newUser.address))
        .to.be.revertedWith("Only the contract owner can call this function");
    });

    it("should set isUser for user1 to true", async function () {
      const addUserTxn = await kye.addUser(user1.address)
      const addUserTxnComplete = await addUserTxn.wait();
      const userStruct = await kye.users(user1.address);

      expect(userStruct['isUser']).to.equal(true);
    });

    it("should set hasDeposited for user1 to false", async function () {
      const userStruct = await kye.users(user1.address);

      expect(userStruct['hasDeposited']).to.equal(false);
    });

    it("should set hasWon for user1 to false", async function() {
      const userStruct = await kye.users(user1.address);

      expect(userStruct['hasWon']).to.equal(false);
    });
  });

  describe("deposit()", () => {
    before(async () => {
      kye = await kyeContract.deploy(ethers.utils.parseEther("1.0"),7,10);
      kyeDeployed = await kye.deployed();
    });

    it("should be reverted if isActive is false", async function () {
      await expect(kye.addUser(user1.address))
        .to.be.revertedWith("Kye has not started yet");
    });
    
    it("should be reverted if called by non-user", async function () {
      const startTxn = await kye.startKye();
      const startTxnComplete = startTxn.wait();
      await kye.addUser(user1.address);

      const nonUser = accounts[2];
      
      await expect(kye.connect(nonUser).deposit({ value: depositAmount }))
        .to.be.revertedWith("Only a user can call this function");
    });

    it("should emit Deposit event", async function () {
      const newDeposit = await kye.connect(user1).deposit({ value: depositAmount });

      expect(newDeposit)
      .to.emit(kye, 'Deposit')
      .withArgs(user1.address, depositAmount);
    });
      
    it("should add depositAmount to totalPool", async function () {
      expect(await kye.totalPool()).to.equal(depositAmount);
    });

    it("should set hasDeposited for user1 to true", async function () {
      const newUser = await kye.users(user1.address);

      expect(newUser['hasDeposited']).to.equal(true);
    });

    it("should push user1 address to orderOfDeposits", async function () {
      const newUser = await kye.users(user1.address);

      expect(await kye.orderOfDeposits(0)).to.equal(user1.address);
    });

    it("should set readyToDistribute to true once all users have deposited", async function () {
      for(const a of accounts.slice(2,11)) {
        await kye.addUser(a.address);
        await kye.connect(a).deposit({ value: depositAmount });
      }

      expect(await kye.readyToDistribute()).to.equal(true);
    });
  });

  describe("distributePool()", () => {
    beforeEach(async () => {

      kye = await kyeContract.deploy(ethers.utils.parseEther("1.0"),7,10);
      kyeDeployed = await kye.deployed();

      const startTxn = await kye.startKye();
      const startTxnComplete = await startTxn.wait();

      for(const a of accounts.slice(1,11)) {
        await (await kye.addUser(a.address)).wait();
      }
    });

    it("should be reverted if lengthOfRound has not passed since lastDistribution", async function () {
      for(const a of accounts.slice(1,11)) {
        await kye.connect(a).deposit({ value: depositAmount });
      }
      
      await expect(kye.connect(user1).distributePool())
        .to.be.revertedWith("Not enough time has passed since last distribution");
    });

    it("should be reverted if not all users have deposited", async function () {
      expect(kye.connect(user1).distributePool())
        .to.be.revertedWith("Not all users have deposited");
    });
    
    it("should distribute pool once all users have deposited", async function () {
      for(const a of accounts.slice(1,11)) {
        await kye.connect(a).deposit({ value: depositAmount });
      }

      const incTime = await network.provider.send("evm_increaseTime", [604800]);
      const mineBlock = await network.provider.send("evm_mine");

      const distribution = await kye.connect(user1).distributePool();
      const user1Struct = await kye.users(user1.address); 
      expect(user1Struct['hasWon']).to.equal(true);
      expect(distribution)
        .to.emit(kye, 'DistributePool')
        .withArgs(user1.address, BigNumber.from("10").pow(19));
    });
  });
});