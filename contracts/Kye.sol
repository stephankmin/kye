pragma solidity ^0.8.0;

import "hardhat/console.sol";

contract Kye {
    uint256 public depositAmount = 1 ether;
    uint256 public totalPool;
    uint256 public startTimestamp;
    uint256 public lastDistribution;
    uint256 public depositPeriod;
    uint256 public requiredNumberOfUsers;
    bool public readyToDistribute = false;
    bool public isActive = false;
    address public owner;
    uint256 public winnerIndex = 0;
    address payable[] public orderOfDeposits;

    mapping(address => User) public users;

    event Deposit(address user, uint256 amount);
    event DistributePool(address user, uint256 amount);

    constructor(uint256 _depositPeriod, uint256 _requiredNumberOfUsers) {
        depositPeriod = _depositPeriod;
        requiredNumberOfUsers = _requiredNumberOfUsers;
        startTimestamp = block.timestamp;
        owner = msg.sender;
    }

    struct User {
        bool isUser;
        bool hasDeposited;
        bool hasWon;
    }

    modifier onlyOwner {
        require(msg.sender == owner, "Only the contract owner can call this function");
        _;
    }

    modifier onlyUser {
        require(users[msg.sender].isUser, "Only a user can call this function");
        _;
    }

    function addUser(address payable userAddress) public onlyOwner {
        console.log("%s has been added to the list of users", userAddress);
        users[userAddress] = User(true, false, false);
    }

    function getDepositAmount() public view returns (uint256) {
        return depositAmount;
    }

    function getDepositPeriod() public view returns (uint256) {
        return depositPeriod;
    }

    function getTotalPool() public view returns (uint256) {
        return totalPool;
    }

    function getReadyToDistribute() public view returns (bool) {
        return readyToDistribute;
    }

    /**
    * @dev Starts the Kye and sets the contract active, allowing users to deposit eth into the contract.
    */
    function startKye() public onlyOwner {
        isActive = true;
        lastDistribution = block.timestamp;
        console.log("Kye has begun. Users may now deposit ether into the contract!");
    }

    /**
    * @dev Deposits eth into the contract pool. Once all users have deposited, readyToDistribute is set to true.
    */
    function deposit() external payable onlyUser {
        require(isActive, "Kye has not started yet");
        require(msg.value == depositAmount, "msg.value must equal depositAmount");

        totalPool += msg.value;
        users[msg.sender].hasDeposited = true;
        orderOfDeposits.push(payable(msg.sender));
        console.log("%s has deposited %d ether", msg.sender, msg.value / 1e18);

        if(totalPool == depositAmount * requiredNumberOfUsers) {
            readyToDistribute = true;
        }
        
        emit Deposit(msg.sender, msg.value);
    }

    function distributePool() external onlyOwner {
        require(isActive, "Kye has not been started yet");
        require(readyToDistribute, "Not all users have deposited.");
        // require(block.timestamp >= lastDistribution + depositPeriod * 1 minutes, "Not enough time has passed since last distribution.");
        
        uint256 total = totalPool;
        totalPool = 0;
        address payable winner = payable(orderOfDeposits[winnerIndex]);
        winnerIndex += 1;
        lastDistribution = block.timestamp;
        users[winner].hasWon = true;
        console.log("%s has received %d ether!", winner, total / 1e18);

        (bool success, ) = winner.call{value: total}("");
        require(success);

        readyToDistribute = false;

        emit DistributePool(winner, total);
    }
}