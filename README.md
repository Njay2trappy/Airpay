This is an Open Source Payment gateway built on AirDAO blockchain, you can build on it. Developer @Unixmachine

# AirPay Telegram Bot

This repository contains the code for the AirPay Telegram Bot, which enables users to deposit AMB tokens on the AirDAO blockchain. The bot generates unique wallets for users, monitors deposits, and transfers the funds to an admin wallet upon confirmation.

## Features

- Users can start a deposit process via Telegram.
- Unique wallet addresses are generated for each user.
- Deposits are monitored in real-time.
- Funds are transferred to an admin wallet upon deposit confirmation.
- Handles expired or canceled deposit processes gracefully.

## Prerequisites

To replicate this project, ensure you have the following installed:

1. [Node.js](https://nodejs.org/) (v14 or higher)
2. [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/) for package management
3. A Telegram account and a bot token from [BotFather](https://core.telegram.org/bots#botfather)
4. A test network RPC URL (e.g., from [Ambrosus](https://ambrosus.io/) or [AirDAO](https://airdao.io/))

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-folder>
```

### 2. Install Dependencies

Install the required packages using npm or yarn:

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory and include the following:

```plaintext
BOT_TOKEN=<your-telegram-bot-token>
RPC_URL=<your-primary-rpc-url>
BACKUP_RPC_URL=<your-backup-rpc-url>
ADMIN_WALLET=<admin-wallet-address>
CHAIN_ID=<network-chain-id>
```

Replace the placeholders with your values:

- `BOT_TOKEN`: The bot token obtained from BotFather.
- `RPC_URL`: Primary RPC endpoint for blockchain connectivity.
- `BACKUP_RPC_URL`: Backup RPC endpoint in case the primary fails.
- `ADMIN_WALLET`: Wallet address to receive funds.
- `CHAIN_ID`: Chain ID of the blockchain network.

### 4. Run the Bot

Start the bot using the following command:

```bash
node index.js
```

The bot should now be running and ready to accept commands.

## How to Use

1. **Start the Bot**:
   - Use the `/start` command in Telegram to initiate the bot.
   - The bot will display a welcome message with an option to start the deposit process.

2. **Initiate Deposit**:
   - Click the "Start Deposit" button.
   - Enter the amount of AMB tokens you want to deposit.
   - The bot will generate a unique wallet address for you to send your payment.

3. **Monitor Deposit**:
   - The bot will monitor the wallet for the specified deposit.
   - Once the deposit is confirmed, the bot will transfer the funds to the admin wallet and notify you.

4. **Cancel Deposit**:
   - If you want to cancel the process, use the "Cancel" button provided during the deposit process.

## Code Overview

### Key Files and Functions

1. **Main File**:
   - The bot's logic is implemented in the main script (`index.js`).

2. **Environment Variables**:
   - Configured in the `.env` file to manage sensitive information like bot tokens and RPC URLs.

3. **Functions**:
   - **Wallet Generation**: Creates unique wallets for users.
   - **Deposit Monitoring**: Periodically checks wallet balances using `ethers.js`.
   - **Transaction Management**: Saves deposit transactions and updates their status.
   - **Admin Transfer**: Transfers deposited funds to the admin wallet upon confirmation.

### Error Handling

- If RPC connections fail, the bot switches to a backup provider.
- Unhandled rejections and exceptions are logged and handled to prevent crashes.

### Dependencies

- `dotenv`: Manages environment variables.
- `telegraf`: Telegram bot framework.
- `ethers`: Blockchain interaction library.
- `fs`: File system module to manage transaction data.

## Customization

You can customize the bot further:

1. **Change Messages**: Modify the bot responses to match your branding.
2. **Add Features**: Extend the bot with additional commands or blockchain interactions.
3. **Deploy on a Server**: Use a service like AWS, Heroku, or a VPS to host the bot continuously.

## Security Considerations

1. **Private Keys**:
   - Ensure that private keys are not exposed in logs or stored insecurely.

2. **Bot Token**:
   - Keep the bot token secure to prevent unauthorized access.

3. **Admin Wallet**:
   - Use a secure wallet and monitor transactions regularly.

## Known Issues and Limitations

- Monitoring is limited to 15 minutes by default.
- Requires manual configuration of environment variables.
- Transaction data is stored locally in a JSON file.

## Troubleshooting

1. **RPC Connection Fails**:
   - Verify the RPC URLs in the `.env` file.
   - Ensure your network supports the specified Chain ID.

2. **Bot Not Responding**:
   - Ensure the bot is running.
   - Check the bot token and permissions in Telegram.

3. **Error During Transfers**:
   - Check the gas price and availability of the admin wallet.

## License

This project is licensed under the MIT License. You are free to modify and distribute it as per the terms of the license.

---

If you encounter any issues or have suggestions, feel free to open an issue in the repository!

