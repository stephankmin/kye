pragma solidity ^0.8.0;

/**
 * Smart contract for on-chain Rotating Savings and Credit Association (ROSCA).
 * Each user in group of n users periodically deposits x amount of ETH into contract.
 * At the end of each "round," once all users have deposited, one user receives lump sum of all deposits (n * x ETH).
 * Order of distributions is set to the order of deposits made during first round.
 * Contract is set to inactive once all users have received one distribution. 
 *
 * Looked at WeTrust's ROSCA smart contract for reference:
 * https://github.com/WeTrustPlatform/rosca-contracts/blob/develop/contracts/ROSCA.sol
 */

contract Kye {
    uint256 public depositAmount;
    uint256 public totalPool;
    uint256 public lastDistribution; // timestamp of most recent distribution
    uint256 public lengthOfRound; // time period between distributions during which users can deposit funds, in days
    uint256 public requiredNumberOfUsers;
    bool public readyToDistribute;
    bool public isActive;
    address public owner;
    uint256 public winnerIndex;
    address payable[] public orderOfDeposits; // for now, pool is distributed based on order of deposits made during first round
    bool public firstRoundInProgress; // if true, order of deposits can be modified

    mapping(address => User) public users;

    event Deposit(address user, uint256 amount);
    event DistributePool(address user, uint256 amount);

    constructor(uint256 _depositAmount, uint256 _lengthOfRound, uint256 _requiredNumberOfUsers) {
        depositAmount = _depositAmount;
        lengthOfRound = _lengthOfRound;
        requiredNumberOfUsers = _requiredNumberOfUsers;
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

    // Starts the ROSCA and sets the contract active, allowing users to deposit ETH into the contract
    function startKye() public onlyOwner {
        isActive = true;
        firstRoundInProgress = true;
        // First distribution can occur only after lengthOfRound has passed since startKye is called
        lastDistribution = block.timestamp;
    }

    // Allows added user to deposit into contract
    // Owner must also be added as user if they would like to deposit into contract
    function addUser(address payable userAddress) public onlyOwner {
        require(isActive, "Kye has not started yet");
        users[userAddress] = User(true, false, false);
    }

    // Deposits ETH into the ROSCA pool. Sets readyToDistribute to true once all users have deposited
    function deposit() external payable onlyUser {
        require(isActive, "Kye has not started yet");
        require(!readyToDistribute, "Required number of deposits has already been reached");
        require(msg.value == depositAmount, "Deposit must equal depositAmount");

        totalPool += msg.value;
        users[msg.sender].hasDeposited = true;

        if(firstRoundInProgress) {
            orderOfDeposits.push(payable(msg.sender));
        }

        if(totalPool == depositAmount * requiredNumberOfUsers) {
            readyToDistribute = true;
        }
        
        emit Deposit(msg.sender, msg.value);
    }

    // Sets contract inactive once all users have received a distribution
    function endKye() internal {
        isActive = false;
    }

    function distributePool() external onlyUser {
        require(isActive, "Kye is not active");
        require(readyToDistribute, "Not all users have deposited");
        require(block.timestamp >= lastDistribution + lengthOfRound * 1 days, "Not enough time has passed since last distribution");
        
        uint256 total = totalPool;
        totalPool = 0;
        address payable winner = payable(orderOfDeposits[winnerIndex]);
        winnerIndex += 1;
        lastDistribution = block.timestamp;
        users[winner].hasWon = true;
        readyToDistribute = false;

        if(firstRoundInProgress) {
            firstRoundInProgress = false;
        }

        (bool success, ) = winner.call{value: total}("");
        require(success);

        emit DistributePool(winner, total);

        if(winnerIndex == requiredNumberOfUsers) {
            endKye();
        }
    }
}