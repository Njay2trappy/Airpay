require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const { ethers } = require("ethers");
const fs = require("fs");

// Environment variables
const BOT_TOKEN = <BOT TOKEN>;
const RPC_URL = "https://network.ambrosus-test.io";
const BACKUP_RPC_URL = "https://testnet-rpc.airdao.io";
const CHAIN_ID = 22040;
const ADMIN_WALLET = <ADMIN WALLET>;

// Validate Bot Token
if (!BOT_TOKEN) {
  throw new Error("Bot token is missing. Please set BOT_TOKEN in your .env file.");
}

// Initialize RPC provider
let provider;
(async () => {
  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    await provider.getBlockNumber(); // Test connection
  } catch (error) {
    console.warn("Default RPC failed. Switching to backup RPC.");
    try {
      provider = new ethers.JsonRpcProvider(BACKUP_RPC_URL);
      await provider.getBlockNumber(); // Test backup connection
    } catch (error) {
      throw new Error("Both RPC connections failed. Check network settings.");
    }
  }
})();

// Initialize Telegraf bot
const bot = new Telegraf(BOT_TOKEN);

// Global variables to manage deposit processes
const userSessions = {};
const transactionsFilePath = "transactions.json";

// Function to load transactions from file
const loadTransactions = () => {
  if (fs.existsSync(transactionsFilePath)) {
    const data = fs.readFileSync(transactionsFilePath);
    return JSON.parse(data);
  } else {
    return [];
  }
};

// Function to save transactions to file
const saveTransaction = (transaction) => {
  const transactions = loadTransactions();
  transactions.push(transaction);
  fs.writeFileSync(transactionsFilePath, JSON.stringify(transactions, null, 2));
};

// Start command
bot.start((ctx) => {
  ctx.reply(
    "🔰Welcome to the AirPay bot!👾 Use the button below to start the deposit process.",
    Markup.inlineKeyboard([Markup.button.callback("Start Deposit", "start_deposit")])
  );
});

// Start Deposit Process
bot.action("start_deposit", (ctx) => {
  const userId = ctx.from.id.toString();

  ctx.reply("🔴Please enter the amount of AMB you'd like your customer to pay:");

  userSessions[userId] = {
    awaitingAmount: true,
  };
});

// Handle User Input for Deposit Amount
bot.on("text", async (ctx) => {
  const userId = ctx.from.id.toString();

  if (userSessions[userId]?.awaitingAmount) {
    const amountToDeposit = parseFloat(ctx.message.text);

    if (isNaN(amountToDeposit) || amountToDeposit <= 0) {
      return ctx.reply("❌Invalid amount! Please enter a valid AMB amount.");
    }

    const wallet = ethers.Wallet.createRandom();
    const walletAddress = wallet.address;
    const privateKey = wallet.privateKey;

    userSessions[userId] = {
      amountToDeposit,
      walletAddress,
      privateKey,
    };

    ctx.reply(
      `⚡️Please make your payment to this address:\n<code>${walletAddress}</code>\n\nChecking your wallet address for a deposit of ${amountToDeposit} AMB.\n\nI'll notify you once the payment is confirmed.`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          Markup.button.callback("❌Cancel", "cancel_process"),
        ]),
      }
    );

    const transaction = {
      userId,
      walletAddress,
      privateKey,
      amountToDeposit,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    saveTransaction(transaction);

    startMonitoringDeposit(ctx, userId, amountToDeposit, transaction);
  }
});

// Cancel Process
bot.action("cancel_process", (ctx) => {
  const userId = ctx.from.id.toString();
  delete userSessions[userId];

  ctx.reply(
    "⚠️Deposit process canceled. Use the button below to start Payment.",
    Markup.inlineKeyboard([Markup.button.callback("Start Deposit", "start_deposit")])
  );
});

// Monitoring Deposit Function
const startMonitoringDeposit = (ctx, userId, amountToDeposit, transaction) => {
  const walletAddress = userSessions[userId].walletAddress;
  const privateKey = userSessions[userId].privateKey;
  let attempts = 0;
  const maxAttempts = 60;
  const interval = 15000;

  const monitor = setInterval(async () => {
    attempts += 1;

    try {
      const balance = await provider.getBalance(walletAddress);
      const balanceInEther = parseFloat(ethers.formatEther(balance));

      if (balanceInEther >= amountToDeposit * 0.99) {
        clearInterval(monitor);
        delete userSessions[userId];

        transaction.status = "confirmed";
        transaction.updatedAt = new Date().toISOString();
        saveTransaction(transaction);

        ctx.reply(`✅Deposit confirmed! Transferring funds to the admin wallet...`);

        try {
          await transferToAdmin(balanceInEther, privateKey);
          ctx.reply(
            `✅Transfer to admin wallet (${ADMIN_WALLET}) was successful! Thank you for your deposit.`,
            Markup.inlineKeyboard([Markup.button.callback("Start Deposit", "start_deposit")])
          );
        } catch (error) {
          ctx.reply("‼️Error during transfer to admin wallet. ♻️Please contact support.");
        }
      } else if (attempts >= maxAttempts) {
        clearInterval(monitor);
        delete userSessions[userId];

        transaction.status = "expired";
        transaction.updatedAt = new Date().toISOString();
        saveTransaction(transaction);

        ctx.reply(
          "🔁Monitoring period expired. No deposit was detected in the last 15 minutes.",
          Markup.inlineKeyboard([Markup.button.callback("Start Deposit", "start_deposit")])
        );
      }
    } catch (error) {
      console.error(error);
      clearInterval(monitor);
      delete userSessions[userId];

      transaction.status = "error";
      transaction.updatedAt = new Date().toISOString();
      saveTransaction(transaction);

      ctx.reply(
        "❌An error occurred while monitoring your wallet. Please try again.",
        Markup.inlineKeyboard([Markup.button.callback("Start Deposit", "start_deposit")])
      );
    }
  }, interval);
};

// Transfer to Admin Wallet Function
const transferToAdmin = async (amount, userPrivateKey) => {
  try {
    const wallet = new ethers.Wallet(userPrivateKey, provider);

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice;

    const tx = {
      to: ADMIN_WALLET,
      value: ethers.parseUnits(amount.toString(), "ether"),
      gasLimit: 21000,
      gasPrice,
    };

    const txResponse = await wallet.sendTransaction(tx);
    await txResponse.wait();
    console.log("Transfer to admin successful:", txResponse.hash);
  } catch (error) {
    console.error("Error during transfer to admin:", error);
    throw error;
  }
};

// Launch the bot
bot.launch();
console.log("Bot is running...");

// Global error handlers
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});
