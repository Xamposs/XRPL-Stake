# XRP-FLR Staking Memo Functionality

This document explains how the XRP-FLR staking application uses XRPL transaction memos to track staking details.

## Overview

When a user stakes XRP, the application creates a transaction with a memo that contains all the relevant staking information. This memo is stored on the XRP Ledger and can be retrieved later to calculate rewards.

## Memo Structure

The memo is stored in the `Memos` field of an XRPL transaction. Each memo has three components:

1. **MemoType**: Identifies the purpose of the memo (set to "XrpFlrStaking" in hex)
2. **MemoData**: Contains the actual staking data (in hex-encoded JSON)
3. **MemoFormat**: Specifies the format of the data (set to "application/json" in hex)

## Staking Data

The staking data stored in the memo includes:

```json
{
  "poolId": "pool1",
  "poolName": "90-Day Lock",
  "startDate": "2023-06-01T00:00:00Z",
  "endDate": "2023-08-30T00:00:00Z",
  "amount": 100,
  "rewardRate": 5.2
}
```

- **poolId**: Identifier for the staking pool
- **poolName**: Human-readable name of the pool
- **startDate**: ISO timestamp when the stake begins
- **endDate**: ISO timestamp when the stake ends
- **amount**: Amount of XRP staked
- **rewardRate**: Annual percentage yield (APY) for the pool

## How It Works

1. **Creating a Stake**:
   - User selects a pool and amount to stake
   - Frontend sends this information to the backend
   - Backend creates an XRPL transaction with the staking memo
   - User signs the transaction with their Xaman wallet

2. **Calculating Rewards**:
   - Backend periodically queries the XRP Ledger for transactions to the staking address
   - It parses the memos to identify staking transactions
   - For each active stake, it calculates the daily reward based on:
     - Staked amount
     - Pool's reward rate
     - Time elapsed since the start date
   - Rewards are accumulated daily until the end date

3. **Claiming Rewards**:
   - User can claim their accumulated Flare rewards
   - Rewards are transferred to the user's Flare wallet

## Technical Implementation

The memo is created in the backend's `/api/stake` endpoint:

```javascript
// Create memo data
const memoData = {
  poolId: poolId,
  poolName: pool.name,
  startDate: startDate.toISOString(),
  endDate: endDate.toISOString(),
  amount: amount,
  rewardRate: pool.rewardRate
};

// Convert memo data to JSON string and then to hex
const memoHex = Buffer.from(JSON.stringify(memoData)).toString('hex').toUpperCase();

// Create a proper XRPL transaction payload with memo
const txjson = {
  TransactionType: 'Payment',
  Destination: 'rJoyoiwgogxk2bA3UBBfZthrb8LdUmocaF', // The staking contract address
  Amount: String(Math.floor(amount * 1000000)), // Convert to drops (1 XRP = 1,000,000 drops)
  Memos: [
    {
      Memo: {
        MemoType: Buffer.from('XrpFlrStaking').toString('hex').toUpperCase(),
        MemoData: memoHex,
        MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase()
      }
    }
  ]
};
```

## Retrieving Memo Data

To retrieve and parse memo data from an XRPL transaction:

```javascript
// Example function to parse memo data from a transaction
function parseStakingMemo(transaction) {
  if (!transaction.Memos || transaction.Memos.length === 0) {
    return null;
  }

  // Find the staking memo
  const stakingMemo = transaction.Memos.find(memo => {
    const memoType = Buffer.from(memo.Memo.MemoType, 'hex').toString();
    return memoType === 'XrpFlrStaking';
  });

  if (!stakingMemo) {
    return null;
  }

  // Parse the memo data
  const memoData = Buffer.from(stakingMemo.Memo.MemoData, 'hex').toString();
  return JSON.parse(memoData);
}
```

## Benefits

- **Transparency**: All staking information is publicly verifiable on the XRP Ledger
- **Immutability**: Once recorded, the staking details cannot be altered
- **Decentralization**: Rewards calculation can be independently verified
- **Efficiency**: No need for a separate database to track staking details
