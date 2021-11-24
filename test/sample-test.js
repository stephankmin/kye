const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Kye", () => {
  let Kye;
  let kye;
  let deployer;
  let accounts;
  let user1;
  let depositAmount;

  before(async () => {
    accounts = await ethers.getSigners();
    deployer = accounts[0];
    user1 = accounts[1];
    Kye = await ethers.getContractFactory("Kye");
    depositAmount = ethers.utils.parseEther("1.0");
  });

  describe("constructor", () => {
    before(async () => {
      kye = await Kye.deploy(ethers.utils.parseEther("1.0"), 7, 10);
      await kye.deployed();
    });

    it("should return depositAmount passed into constructor", async function () {
      expect(await kye.depositAmount()).to.equal(
        ethers.utils.parseEther("1.0")
      );
    });

    it("should return lengthOfRound passed into constructor", async function () {
      expect(await kye.lengthOfRound()).to.equal(7);
    });

    it("should return requiredNumberOfUsers passed into constructor", async function () {
      expect(await kye.requiredNumberOfUsers()).to.equal(10);
    });
  });

  describe("startKye()", () => {
    before(async () => {
      kye = await Kye.deploy(ethers.utils.parseEther("1.0"), 7, 10);
      await kye.deployed();
    });

    describe("when called by non-owner", () => {
      it("should be reverted if called by non-owner", async function () {
        await expect(kye.connect(user1).startKye()).to.be.revertedWith(
          "Only the contract owner can call this function"
        );
      });
    });

    describe("when called by owner", () => {
      before(async () => {
        const startPromise = await kye.startKye();
        await startPromise.wait();
      });

      it("should set isActive to true", async function () {
        expect(await kye.isActive()).to.equal(true);
      });
  
      it("should set firstRoundInProgress to true", async function () {
        expect(await kye.firstRoundInProgress()).to.equal(true);
      });
  
      it("should set lastDistribution to the current block timestamp", async function () {
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        const timestamp = block.timestamp;
  
        expect(await kye.lastDistribution()).to.equal(timestamp);
      });
    });
  });

  describe("addUser()", () => {
    before(async () => {
      kye = await Kye.deploy(ethers.utils.parseEther("1.0"), 7, 10);
      await kye.deployed();
    });

    describe("when startKye() has not been called", () => {
      it("should be reverted", async function () {
        await expect(kye.addUser(user1.address)).to.be.revertedWith(
          "Kye has not started yet"
        );
      });
    });

    describe("when startKye() has been called", () => {
      before(async () => {
        const startPromise = await kye.startKye();
        await startPromise.wait();
      });

      it("should be reverted if called by non-owner", async function () {
        const newUser = accounts[2];
        await expect(
          kye.connect(user1).addUser(newUser.address)
        ).to.be.revertedWith("Only the contract owner can call this function");
      });

      it("should set isUser for user1 to true", async function () {
        const addUserPromise = await kye.addUser(user1.address);
        await addUserPromise.wait();
        const userStruct = await kye.users(user1.address);
  
        expect(userStruct["isUser"]).to.equal(true);
      });
  
      it("should set hasDeposited for user1 to false", async function () {
        const userStruct = await kye.users(user1.address);
  
        expect(userStruct["hasDeposited"]).to.equal(false);
      });
  
      it("should set hasWon for user1 to false", async function () {
        const userStruct = await kye.users(user1.address);
  
        expect(userStruct["hasWon"]).to.equal(false);
      });
    });
  });

  describe("deposit()", () => {
    before(async () => {
      kye = await Kye.deploy(ethers.utils.parseEther("1.0"), 7, 10);
      await kye.deployed();
    });

    describe("when startKye() has not been called", () => {
      it("should be reverted if isActive is false", async function () {
        await expect(kye.addUser(user1.address)).to.be.revertedWith(
          "Kye has not started yet"
        );
      });
    });

    describe("when startKye() has been called", () => {
      before(async () => {
        const startPromise = await kye.startKye();
        await startPromise.wait();
      });

      it("should be reverted if called by non-user", async function () {
        await kye.addUser(user1.address);
        const nonUser = accounts[2];
  
        await expect(
          kye.connect(nonUser).deposit({ value: depositAmount })
        ).to.be.revertedWith("Only a user can call this function");
      });

      describe("when one user has deposited", () => {
        let firstDeposit;

        before(async () => {
          firstDeposit = await kye
          .connect(user1)
          .deposit({ value: depositAmount });
        });

        it("should emit Deposit event", async function () {
          expect(firstDeposit)
            .to.emit(kye, "Deposit")
            .withArgs(user1.address, depositAmount);
        });
    
        it("should add depositAmount to totalPool", async function () {
          expect(await kye.totalPool()).to.equal(depositAmount);
        });
    
        it("should set hasDeposited for user1 to true", async function () {
          const newUser = await kye.users(user1.address);
    
          expect(newUser["hasDeposited"]).to.equal(true);
        });
    
        it("should push user1 address to orderOfDeposits", async function () {
          await kye.users(user1.address);
    
          expect(await kye.orderOfDeposits(0)).to.equal(user1.address);
        });
      });

      describe("when all users have deposited", () => {
        it("should set readyToDistribute to true", async function () {
          for (const a of accounts.slice(2, 11)) {
            await kye.addUser(a.address);
            await kye.connect(a).deposit({ value: depositAmount });
          }
    
          expect(await kye.readyToDistribute()).to.equal(true);
        });
      });
    });
  });

  describe("distributePool()", () => {
    beforeEach(async () => {
      kye = await Kye.deploy(ethers.utils.parseEther("1.0"), 7, 10);
      await kye.deployed();

      const startPromise = await kye.startKye();
      await startPromise.wait();

      for (const a of accounts.slice(1, 11)) {
        const addUserPromise = await kye.addUser(a.address);
        await addUserPromise.wait();
      }
    });

    describe("when not all users have deposited", () => {
      it("should be reverted if not all users have deposited", async function () {
        expect(kye.connect(user1).distributePool()).to.be.revertedWith(
          "Not all users have deposited"
        );
      });
    });

    describe("when all users have deposited", () => {
      it("should be reverted if lengthOfRound has not passed since lastDistribution", async function () {
        for (const a of accounts.slice(1, 11)) {
          await kye.connect(a).deposit({ value: depositAmount });
        }
  
        await expect(kye.connect(user1).distributePool()).to.be.revertedWith(
          "Not enough time has passed since last distribution"
        );
      });

      it("should distribute pool", async function () {
        for (const a of accounts.slice(1, 11)) {
          await kye.connect(a).deposit({ value: depositAmount });
        }
  
        await network.provider.send("evm_increaseTime", [604800]);
        await network.provider.send("evm_mine");
  
        const distribution = await kye.connect(user1).distributePool();
        const user1Struct = await kye.users(user1.address);
        expect(user1Struct["hasWon"]).to.equal(true);
        expect(distribution)
          .to.emit(kye, "DistributePool")
          .withArgs(user1.address, BigNumber.from("10").pow(19));
      });
    });
  });
});
