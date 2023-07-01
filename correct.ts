import { PrismaClient } from "@prisma/client";
import { ethers, JsonRpcApiProvider } from "ethers";
import {
  PUBLIC_PROVIDER,
  getUniqueAddressOrderTypeWithBlockCumulative,
  OrderType,
  updateTaskReplace,
  TASK_IDS,
} from ".";

const prisma = new PrismaClient();

async function main() {
  const provider = new ethers.JsonRpcProvider(PUBLIC_PROVIDER, 59140);
  await correctSwapOrders(provider);
}

async function correctSwapOrders(provider: JsonRpcApiProvider) {
  const currentBlock = await provider.getBlockNumber();
  const addresses = await getUniqueAddressOrderTypeWithBlockCumulative(
    OrderType.Swap,
    currentBlock
  );

  await updateTaskReplace(TASK_IDS.SWAP, Array.from(addresses));
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
