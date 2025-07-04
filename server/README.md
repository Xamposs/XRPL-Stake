# XRP-FLR Staking Backend Server

This is the backend server for the XRP-FLR staking application. It handles the Xaman (XUMM) wallet integration and transaction creation to avoid CORS issues.

## Setup

1. Install dependencies:
   ```
   cd server
   npm install
   ```

2. Create a `.env` file based on the `.env.example` file:
   ```
   cp .env.example .env
   ```

3. Update the `.env` file with your Xaman (XUMM) API credentials:
   ```
   XAMAN_API_KEY=your_xaman_api_key
   XAMAN_API_SECRET=your_xaman_api_secret
   ```

4. Start the server:
   ```
   npm run dev
   ```

## API Endpoints

### Create Staking Transaction

- **URL**: `/api/stake`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "userAddress": "rUserXRPAddress",
    "poolId": "pool1",
    "amount": 100
  }
  ```
- **Response**:
  ```json
  {
    "uuid": "transaction-uuid",
    "next": {
      "always": "https://xumm.app/sign/..."
    },
    "refs": {
      "qr_png": "https://xumm.app/sign/...",
      "qr_matrix": "https://xumm.app/sign/..."
    }, "pushed": true
  }
  ```

### Unstake XRP (Request Unstaking)

- **URL**: `/api/unstake`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "userAddress": "rUserXRPAddress",
    "amount": 10,
    "stakeId": "unique-stake-identifier"
  }
  ```
- **Response (Success - Pending Admin Signature)**:
  ```json
  {
    "status": "pending",
    "message": "Unstaking request received. Admin needs to sign the return transaction.",
    "requestId": "xumm-payload-uuid",
    "paymentUrl": "https://xumm.app/sign/...",
    "payload": { /* Xumm payload object */ },
    "timestamp": 1678886400000
  }
  ```
- **Response (Error - e.g., Stake Not Found)**:
  ```json
  {
    "error": "Stake not found. It may have already been unstaked."
  }
  ```

### Check Transaction Status

- **URL**: `/api/transaction/:uuid`
- **Method**: `GET`
- **Response**:
  ```json
  {
    "meta": {
      "exists": true,
      "uuid": "transaction-uuid",
      "multisign": false,
      "submit": true,
      "destination": "rDestinationAddress",
      "resolved_destination": "rDestinationAddress",
      "resolved": true,
      "signed": true,
      "cancelled": false,
      "expired": false,
      "pushed": true,
      "app_opened": true,
      "opened_by_deeplink": true,
      "return_url_app": null,
      "return_url_web": null,
      "is_xapp": false,
      "signers": []
    },
    "application": {
      "name": "Your App Name",
      "description": "Your App Description",
      "disabled": 0,
      "uuidv4": "app-uuid",
      "icon_url": "https://example.com/icon.png",
      "issued_user_token": null
    },
    "payload": {
      "tx_type": "Payment",
      "tx_destination": "rDestinationAddress",
      "tx_destination_tag": null,
      "request_json": {
        "TransactionType": "Payment",
        "Destination": "rDestinationAddress",
        "Amount": "100000000"
      },
      "created_at": "2023-01-01T00:00:00Z",
      "expires_at": "2023-01-01T01:00:00Z",
      "expires_in_seconds": 3600
    },
    "response": {
      "hex": "signed-transaction-blob",
      "txid": "transaction-hash",
      "resolved_at": "2023-01-01T00:05:00Z",
      "dispatched_to": "wss://xrplcluster.com",
      "dispatched_nodetype": "MAINNET",
      "dispatched_result": "tesSUCCESS",
      "dispatched_to_node": true,
      "dispatched_to_node_at": "2023-01-01T00:05:01Z",
      "environment_nodeuri": "wss://xrplcluster.com",
      "environment_nodetype": "MAINNET",
      "multisigned": false,
      "account": "rUserXRPAddress"
    },
    "custom_meta": {
      "identifier": null,
      "blob": null,
      "instruction": null
    }
  }
  ```
