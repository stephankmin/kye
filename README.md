# On-Chain Rotating Savings and Credit Association (ROSCA)

Each user in a group of n users periodically deposits x amount of ETH into the contract.
At the end of each "round," once all users have deposited, one user receives a lump sum of all deposits (n * x ETH). The deposit amount, round length, and required number of users are all set when the contract is first initialized.
The order of distributions is set to the order of deposits made during first round.
The contract is set to inactive once all users have received one distribution.

The contract is named after the Korean word for ROSCA.

Known issues:
This is a proof of concept. As of now, there is no mechanism to require users to continue depositing into the contract in subsequent rounds after they have already received their distribution.
