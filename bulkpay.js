require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const { ethers } = require("ethers");
const fs = require("fs").promises;
const path = require("path");

// Environment variables
const BOT_TOKEN = <BOT TOKEN>;
const RPC_URL = "https://network.ambrosus.io/";
const BACKUP_RPC_URL = "https://network.ambrosus.io/";

// File Paths for Persistence
const USERS_FILE_PATH = path.join(__dirname, "users.json");

// Connect to AirDAO blockchain
let provider = new ethers.JsonRpcProvider(RPC_URL);
provider.getBlockNumber().catch(async () => {
  console.warn("Default RPC failed. Switching to backup RPC.");
  provider = new ethers.JsonRpcProvider(BACKUP_RPC_URL);
  try {
    await provider.getBlockNumber();
  } catch (err) {
    console.error("Backup RPC also failed. Please check your network settings.");
  }
});

// Initialize Telegraf bot
const bot = new Telegraf(BOT_TOKEN);

// Load Users from file
const loadUsers = async () => {
  if (await fs.stat(USERS_FILE_PATH).catch(() => false)) {
    const data = await fs.readFile(USERS_FILE_PATH, "utf-8");
    return JSON.parse(data);
  }
  return {};
};

// Save Users to file
const saveUsers = async (users) => {
  await fs.writeFile(USERS_FILE_PATH, JSON.stringify(users, null, 2));
};

// Start command
bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  const users = await loadUsers();

  if (!users[userId]) {
    const wallet = ethers.Wallet.createRandom();
    const walletAddress = wallet.address;
    const privateKey = wallet.privateKey;

    users[userId] = { walletAddress, privateKey };
    await saveUsers(users);

    ctx.reply(`🚀This wallet is your bulk withdrawal wallet:\n<code>${walletAddress}</code>`, {
      parse_mode: "HTML",
    });
  } else {
    const walletAddress = users[userId].walletAddress;
    ctx.reply(`♻️Welcome back! This is your account address:\n<code>${walletAddress}</code>`, {
      parse_mode: "HTML",
    });
  }

  ctx.reply(
    "🔰Welcome to the AirPay bot! You can check your wallet balance or transfer AMB to multiple wallets.",
    Markup.inlineKeyboard([
      Markup.button.callback("Check Balance", "check_balance"),
      Markup.button.callback("Start Transfer", "start_transfer"),
    ])
  );
});

// Check Balance Button
bot.action("check_balance", async (ctx) => {
  const userId = ctx.from.id.toString();
  const users = await loadUsers();

  if (!users[userId]) {
    return ctx.reply("You do not have a wallet yet. Please use the Start button to create one.");
  }

  const walletAddress = users[userId].walletAddress;

  try {
    const balance = await provider.getBalance(walletAddress);
    const balanceInEther = ethers.formatEther(balance);
    ctx.reply(`🔴Your wallet balance is: ${balanceInEther} AMB`);
  } catch (error) {
    ctx.reply("❌Error checking wallet balance. Please try again.");
    console.error(error);
  }
});

// Start Transfer Button
bot.action("start_transfer", async (ctx) => {
  const userId = ctx.from.id.toString();
  const users = await loadUsers();

  if (!users[userId]) {
    return ctx.reply("You do not have a wallet yet. Please use the Start button to create one.");
  }

  const walletAddress = users[userId].walletAddress;
  ctx.reply(
    `🌐Your wallet address is:\n<code>${walletAddress}</code>\n\n⚠️Please enter the wallet addresses you'd like to transfer AMB to, separated by commas (e.g., address1, address2, address3):`,
    { parse_mode: "HTML" }
  );

  users[userId].awaitingbulkWallets = true;
  await saveUsers(users);
});

// Handle User Input for Bulk Wallets
bot.on("text", async (ctx) => {
  const userId = ctx.from.id.toString();
  const users = await loadUsers();

  if (!users[userId]) {
    return ctx.reply("You do not have a wallet yet. Please use the Start button to create one.");
  }

  if (users[userId]?.awaitingbulkWallets) {
    const bulkWalletsInput = ctx.message.text;
    const bulkWallets = bulkWalletsInput.split(",").map((address) => address.trim());
    
    // Validate each bulk wallet address
    const invalidWallets = bulkWallets.filter((wallet) => !ethers.isAddress(wallet));
  
    if (invalidWallets.length > 0) {
      return ctx.reply(`❌Invalid AMB address(es): ${invalidWallets.join(", ")}. Please provide valid wallet addresses.`);
    }
  
    users[userId].bulkWallets = bulkWallets;
    delete users[userId].awaitingbulkWallets;
    await saveUsers(users);
  
    ctx.reply(
      `🚀Bulk wallet addresses set: ${bulkWallets.join(", ")}\n\n👇Now, please enter the amount of AMB you want to transfer to each wallet.`
    );
    users[userId].awaitingTransferAmount = true;
    await saveUsers(users);  
  } else if (users[userId]?.awaitingTransferAmount) {
    const transferAmount = parseFloat(ctx.message.text);

    if (isNaN(transferAmount) || transferAmount <= 0) {
      return ctx.reply("❌Invalid transfer amount. Please enter a valid positive number.");
    }

    const { walletAddress, privateKey, bulkWallets } = users[userId];

    try {
      const balance = await provider.getBalance(walletAddress);
      const balanceInEther = parseFloat(ethers.formatEther(balance));
      const totalTransferAmount = transferAmount * bulkWallets.length;

      if (totalTransferAmount > balanceInEther) {
        return ctx.reply(
          `❌You don't have enough funds to transfer ${totalTransferAmount} AMB. Your balance is ${balanceInEther} AMB.`
        );
      }

      ctx.reply(`🚀Transferring ${totalTransferAmount} AMB to bulk wallets...`);

      for (const bulkWallet of bulkWallets) {
        try {
          const txHash = await transferTobulk(transferAmount, privateKey, bulkWallet);
          ctx.reply(`✅Successfully transferred ${transferAmount} AMB to <code>${bulkWallet}</code>.\nTxHash: <code>${txHash}</code>`, {
            parse_mode: "HTML",
          });
        } catch (error) {
          console.error(`Error transferring to ${bulkWallet}:`, error);
          ctx.reply(`❌Failed to transfer to ${bulkWallet}.`);
        }
      }

      delete users[userId].awaitingTransferAmount;
      delete users[userId].bulkWallets;
      await saveUsers(users);

      ctx.reply(
        `✅Withdrawal complete. Thank you for using 👾AirPay bot!`,
        Markup.inlineKeyboard([
          Markup.button.callback("Check Balance", "check_balance"),
          Markup.button.callback("Start Transfer", "start_transfer"),
        ])
      );
    } catch (error) {
      console.error(error);
      ctx.reply("⚠️Error during transfer. Please try again.");
    }
  }
});

// Transfer to Bulk Wallet Function
const transferTobulk = async (amount, userPrivateKey, bulkWallet) => {
  try {
    const wallet = new ethers.Wallet(userPrivateKey, provider);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice

    const tx = {
      to: bulkWallet,
      value: ethers.parseUnits(amount.toString(), "ether"),
      gasLimit: 21000,
      gasPrice,
    };

    const txResponse = await wallet.sendTransaction(tx);
    await txResponse.wait();
    return txResponse.hash;
  } catch (error) {
    console.error("Error during transfer:", error);
    throw error;
  }
};

// Bot Error Handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
});

// Launch the bot
bot.launch();
console.log("Bot is running...");
