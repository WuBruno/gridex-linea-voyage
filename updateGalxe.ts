import { ethers } from "ethers";
import {
  PUBLIC_PROVIDER,
  updateAllAdvancedOrders,
  updateAllMakerOrders,
  updateAllSwapOrders,
} from ".";
import { PrismaClient } from "@prisma/client";
require("dotenv").config();

const prisma = new PrismaClient();

async function main() {
  const provider = new ethers.JsonRpcProvider(PUBLIC_PROVIDER, 59140);

  console.log("ALL ADVANCED ---------");
  await updateAllAdvancedOrders(provider);
  console.log("ALL MAKER ---------");
  await updateAllMakerOrders(provider);
  console.log("ALL SWAP ---------");
  await updateAllSwapOrders(provider);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
