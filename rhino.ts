import { JsonRpcApiProvider, ethers, formatUnits, parseUnits } from "ethers";
import { Order, OrderType, adjustableQueryFilter, getClosestBlock } from ".";
import { GridAbi } from "./abi/Grid";

const LINEA_MAINNET =
  "https://linea-mainnet.infura.io/v3/adc363155d5f49dabddd8c45475525ae";

const abs = (n) => (n < 0n ? -n : n);

// const EVENT_START_BLOCK = await getClosestBlock(
//   "2023-08-11T16:00:00",
//   provider
// ); // 174171

const GRID = "0x4A1a52316bFb5B14d08c13426943f0F94dfFc282";

type SwapEvent = {
  user: string;
  amount: bigint;
};

async function getSwapEvents(
  provider: JsonRpcApiProvider,
  blockStart?: number,
  blockEnd?: number
): Promise<SwapEvent[]> {
  const gridContract = new ethers.Contract(GRID, GridAbi, provider);
  const events = await adjustableQueryFilter(
    gridContract,
    gridContract.filters.Swap(),
    blockStart,
    blockEnd
  );
  return events.map((event) => ({
    user: event.args[1],
    amount: event.args[2],
  }));
}

async function getMakerEvents(
  provider: JsonRpcApiProvider,
  blockStart?: number,
  blockEnd?: number
) {
  const gridContract = new ethers.Contract(GRID, GridAbi, provider);
  const events = await adjustableQueryFilter(
    gridContract,
    gridContract.filters.PlaceMakerOrder(),
    blockStart,
    blockEnd
  );
  return events.map((event) => event.args[1] as string);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(LINEA_MAINNET, 59144);

  const currentBlock = await provider.getBlockNumber();
  const startBlock = 174171;

  const swaps = await getSwapEvents(provider, startBlock, currentBlock);
  const makerAddresses = await getMakerEvents(
    provider,
    startBlock,
    currentBlock
  );

  const volume = swaps.reduce((acc, order) => (acc += abs(order.amount)), 0n);
  const uniqueSwapAddress = new Set(swaps.map((swap) => swap.user));
  const swapCount = swaps.length;
  console.log(formatUnits(volume, 6), swapCount, uniqueSwapAddress.size);

  const makerAddressCount = makerAddresses.length;
  const uniqueMakerAddress = new Set(makerAddresses);
  console.log(makerAddressCount, uniqueMakerAddress.size);
}

main();
