"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUBLIC_PROVIDER = exports.updateAllSwapOrders = exports.updateAllMakerOrders = exports.updateAllAdvancedOrders = exports.updateSwapOrders = exports.updateMakerOrders = exports.processMakerOrders = exports.getHistoricalOrderStats = exports.processSwapEvents = exports.updateTasks = exports.updateTaskReplace = exports.TASK_IDS = exports.getMakerOrders = exports.classifyMakerOrder = exports.OrderType = exports.adjustableQueryFilter = exports.getMakerOrderEvents = exports.getSwapEvents = exports.getUniqueOrderAddresses = exports.getClosestBlock = exports.getMostRecentBlockMaker = exports.getMostRecentBlockSwap = exports.getUniqueAddressOrderTypeWithBlockInterval = exports.getUniqueAddressOrderTypeWithBlockCumulative = exports.getUniqueAddressOrderType = exports.MAKER_ORDER_HASH = exports.BATCH_ORDER_HASH = exports.RELATIVE_ORDER_HASH = void 0;
const ethers_1 = require("ethers");
const Grid = __importStar(require("./abi/Grid.json"));
const axios_1 = __importDefault(require("axios"));
const client_1 = require("@prisma/client");
require("dotenv").config();
const prisma = new client_1.PrismaClient();
exports.RELATIVE_ORDER_HASH = "0xc23e3b38";
exports.BATCH_ORDER_HASH = "0xa6fcb341";
exports.MAKER_ORDER_HASH = "0x42d95cc7";
const GRID_ADDRESS = "0xCF3D9B1793F6714C2c5ec68c7641d13F514eEd55";
const GRID2_ADDRESS = "0x5984FE9Fb63be89B11D701E64016C77108a3a2C8";
const GRID3_ADDRESS = "0xb15A3031746E265a6eAB58E55286A7E408c050e9";
const MAKER_ORDER_MANAGER = "0x36E56CC52d7A0Af506D1656765510cd930fF1595";
function getUniqueAddressOrderType(orderType) {
    return __awaiter(this, void 0, void 0, function* () {
        const addresses = yield prisma.order.findMany({
            select: {
                address: true,
            },
            where: {
                type: orderType,
            },
        });
        return new Set(addresses.map((address) => address.address));
    });
}
exports.getUniqueAddressOrderType = getUniqueAddressOrderType;
function getUniqueAddressOrderTypeWithBlockCumulative(orderType, endBlock) {
    return __awaiter(this, void 0, void 0, function* () {
        const addresses = yield prisma.order.findMany({
            select: {
                address: true,
            },
            where: {
                type: orderType,
                block: {
                    lte: endBlock,
                },
            },
        });
        return new Set(addresses.map((address) => address.address));
    });
}
exports.getUniqueAddressOrderTypeWithBlockCumulative = getUniqueAddressOrderTypeWithBlockCumulative;
function getUniqueAddressOrderTypeWithBlockInterval(orderType, startBlock, endBlock) {
    return __awaiter(this, void 0, void 0, function* () {
        const addresses = yield prisma.order.findMany({
            select: {
                address: true,
            },
            where: {
                type: orderType,
                block: {
                    gte: startBlock,
                    lte: endBlock,
                },
            },
        });
        return new Set(addresses.map((address) => address.address));
    });
}
exports.getUniqueAddressOrderTypeWithBlockInterval = getUniqueAddressOrderTypeWithBlockInterval;
function getMostRecentBlockSwap() {
    return prisma.order
        .findFirst({
        orderBy: {
            block: "desc",
        },
        where: {
            type: OrderType.Swap,
        },
    })
        .then((order) => order.block);
}
exports.getMostRecentBlockSwap = getMostRecentBlockSwap;
function getMostRecentBlockMaker() {
    return prisma.order
        .findFirst({
        orderBy: {
            block: "desc",
        },
        where: {
            type: {
                in: [OrderType.Batch, OrderType.Maker, OrderType.Relative],
            },
        },
    })
        .then((order) => order.block);
}
exports.getMostRecentBlockMaker = getMostRecentBlockMaker;
function getClosestBlock(date, provider) {
    return __awaiter(this, void 0, void 0, function* () {
        const timestamp = new Date(date).getTime() / 1000;
        let minBlockNumber = 0;
        let maxBlockNumber = yield provider.getBlockNumber();
        let closestBlockNumber = Math.floor((maxBlockNumber + minBlockNumber) / 2);
        let closestBlock = yield provider.getBlock(closestBlockNumber);
        let foundExactBlock = false;
        while (minBlockNumber <= maxBlockNumber) {
            if (closestBlock.timestamp === timestamp) {
                foundExactBlock = true;
                break;
            }
            else if (closestBlock.timestamp > timestamp) {
                maxBlockNumber = closestBlockNumber - 1;
            }
            else {
                minBlockNumber = closestBlockNumber + 1;
            }
            closestBlockNumber = Math.floor((maxBlockNumber + minBlockNumber) / 2);
            closestBlock = yield provider.getBlock(closestBlockNumber);
        }
        const previousBlockNumber = closestBlockNumber - 1;
        const previousBlock = yield provider.getBlock(previousBlockNumber);
        const nextBlockNumber = closestBlockNumber + 1;
        const nextBlock = yield provider.getBlock(nextBlockNumber);
        return closestBlockNumber;
    });
}
exports.getClosestBlock = getClosestBlock;
function getUniqueOrderAddresses(events) {
    return new Set(events.map((event) => event.address));
}
exports.getUniqueOrderAddresses = getUniqueOrderAddresses;
const MAIN_GRIDS = [GRID_ADDRESS, GRID2_ADDRESS, GRID3_ADDRESS];
const OTHER_GRIDS = [
    "0x9969b00DAD3b1328e5da7E87df7b7A8acaCF725d",
    "0x8C50663001b2F0C32c9F0B80CC3EDf29C1836128",
];
function getSwapEvents(provider, blockStart, blockEnd) {
    return __awaiter(this, void 0, void 0, function* () {
        const addresses = yield Promise.all([...MAIN_GRIDS, ...OTHER_GRIDS].map((grid) => __awaiter(this, void 0, void 0, function* () {
            const gridContract = new ethers_1.ethers.Contract(grid, Grid.abi, provider);
            return yield adjustableQueryFilter(gridContract, gridContract.filters.Swap(), blockStart, blockEnd);
        })));
        return yield Promise.all(addresses.flat().map((event) => __awaiter(this, void 0, void 0, function* () {
            const txn = yield event.getTransaction();
            return {
                hash: txn.hash,
                address: txn.from,
                block: txn.blockNumber,
                orderType: OrderType.Swap,
            };
        })));
    });
}
exports.getSwapEvents = getSwapEvents;
function getMakerOrderEvents(provider, blockStart, blockEnd) {
    return __awaiter(this, void 0, void 0, function* () {
        const gridContract = new ethers_1.ethers.Contract(GRID_ADDRESS, Grid.abi, provider);
        const gridContract2 = new ethers_1.ethers.Contract(GRID2_ADDRESS, Grid.abi, provider);
        const gridContract3 = new ethers_1.ethers.Contract(GRID3_ADDRESS, Grid.abi, provider);
        return [
            ...(yield adjustableQueryFilter(gridContract, gridContract.filters.PlaceMakerOrder(), blockStart, blockEnd)),
            ...(yield adjustableQueryFilter(gridContract2, gridContract2.filters.PlaceMakerOrder(), blockStart, blockEnd)),
            ...(yield adjustableQueryFilter(gridContract3, gridContract3.filters.PlaceMakerOrder(), blockStart, blockEnd)),
        ];
    });
}
exports.getMakerOrderEvents = getMakerOrderEvents;
function adjustableQueryFilter(contract, filter, blockStart, blockEnd) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("querying", blockStart, blockEnd);
            const results = (yield contract.queryFilter(filter, blockStart, blockEnd));
            return results;
        }
        catch (error) {
            if (((_a = error === null || error === void 0 ? void 0 : error.error) === null || _a === void 0 ? void 0 : _a.code) === -32005) {
                const blockAmount = blockEnd - blockStart;
                const mid = blockStart + Math.floor(blockAmount / 2);
                return [
                    ...(yield adjustableQueryFilter(contract, filter, blockStart, mid)),
                    ...(yield adjustableQueryFilter(contract, filter, mid + 1, blockEnd)),
                ];
            }
            console.log(error);
        }
    });
}
exports.adjustableQueryFilter = adjustableQueryFilter;
var OrderType;
(function (OrderType) {
    OrderType["Maker"] = "Maker";
    OrderType["Batch"] = "Batch";
    OrderType["Relative"] = "Relative";
    OrderType["Unknown"] = "Unknown";
    OrderType["Swap"] = "Swap";
})(OrderType || (exports.OrderType = OrderType = {}));
function classifyMakerOrder(event) {
    return __awaiter(this, void 0, void 0, function* () {
        const txn = yield event.getTransaction();
        let orderType = OrderType.Unknown;
        if (txn.data.startsWith(exports.MAKER_ORDER_HASH)) {
            orderType = OrderType.Maker;
        }
        else if (txn.data.startsWith(exports.BATCH_ORDER_HASH)) {
            orderType = OrderType.Batch;
        }
        else if (txn.data.startsWith(exports.RELATIVE_ORDER_HASH)) {
            orderType = OrderType.Relative;
        }
        return {
            hash: txn.hash,
            address: event.args[1],
            block: txn.blockNumber,
            orderType,
        };
    });
}
exports.classifyMakerOrder = classifyMakerOrder;
function getMakerOrders(provider, blockStart, blockEnd) {
    return __awaiter(this, void 0, void 0, function* () {
        const makerOrderEvents = yield getMakerOrderEvents(provider, blockStart, blockEnd);
        console.log(makerOrderEvents.length);
        const orders = yield Promise.all(makerOrderEvents.map(classifyMakerOrder));
        yield prisma.$transaction(orders.map((order) => prisma.order.upsert({
            create: {
                hash: order.hash,
                address: order.address,
                block: order.block,
                type: order.orderType,
            },
            update: {},
            where: {
                hash: order.hash,
            },
        })));
        const makerOrders = orders.filter((order) => order.orderType === OrderType.Maker);
        const batchOrders = orders.filter((order) => order.orderType === OrderType.Batch);
        const relativeOrders = orders.filter((order) => order.orderType === OrderType.Relative);
        const unknownOrder = orders.filter((order) => order.orderType === OrderType.Unknown);
        console.log("Maker Order Addresses", getUniqueOrderAddresses(makerOrders).size);
        console.log("Batch Order Addresses", getUniqueOrderAddresses(batchOrders).size);
        console.log("Relative Order Addresses", getUniqueOrderAddresses(relativeOrders).size);
        console.log("Unkown Order Addresses", getUniqueOrderAddresses(unknownOrder).size);
        return {
            makerOrders,
            batchOrders,
            relativeOrders,
        };
    });
}
exports.getMakerOrders = getMakerOrders;
var TASK_IDS;
(function (TASK_IDS) {
    TASK_IDS["SWAP"] = "294483983094947840";
    TASK_IDS["MAKER"] = "294486182093037568";
    TASK_IDS["ADVANCED"] = "294488445817626624";
})(TASK_IDS || (exports.TASK_IDS = TASK_IDS = {}));
function updateTaskReplace(credId, addresses) {
    return __awaiter(this, void 0, void 0, function* () {
        const operation = "REPLACE";
        const res = yield axios_1.default.post("https://graphigo.prd.galaxy.eco/query", {
            operationName: "credentialItems",
            query: `
      mutation credentialItems($credId: ID!, $operation: Operation!, $items: [String!]!) 
        { 
          credentialItems(input: { 
            credId: $credId 
            operation: $operation 
            items: $items 
          }) 
          { 
            name 
          } 
        }
      `,
            variables: {
                // Make sure this is string type as int might cause overflow
                credId: credId.toString(),
                operation: operation,
                items: addresses,
            },
        }, {
            headers: {
                "access-token": process.env.GALXE_ACCESS_TOKEN,
            },
        });
        console.log(res.status);
        return res;
    });
}
exports.updateTaskReplace = updateTaskReplace;
function updateTasks(credId, addresses) {
    return __awaiter(this, void 0, void 0, function* () {
        const operation = "APPEND";
        const res = yield axios_1.default.post("https://graphigo.prd.galaxy.eco/query", {
            operationName: "credentialItems",
            query: `
      mutation credentialItems($credId: ID!, $operation: Operation!, $items: [String!]!) 
        { 
          credentialItems(input: { 
            credId: $credId 
            operation: $operation 
            items: $items 
          }) 
          { 
            name 
          } 
        }
      `,
            variables: {
                // Make sure this is string type as int might cause overflow
                credId: credId.toString(),
                operation: operation,
                items: addresses,
            },
        }, {
            headers: {
                "access-token": process.env.GALXE_ACCESS_TOKEN,
            },
        });
        console.log(res.status);
        return res;
    });
}
exports.updateTasks = updateTasks;
function processSwapEvents(provider, blockStart, blockEnd) {
    return __awaiter(this, void 0, void 0, function* () {
        const swapEvents = yield getSwapEvents(provider, blockStart, blockEnd);
        const swapAddresses = yield getUniqueAddressOrderType(OrderType.Swap);
        const newAddresses = Array.from(getUniqueOrderAddresses(swapEvents)).filter((address) => !swapAddresses.has(address));
        yield updateTasks(TASK_IDS.SWAP, newAddresses);
        console.log("Swap event count", swapEvents.length);
        console.log("New swap addresses", newAddresses.length);
        yield prisma.$transaction(swapEvents.map((swap) => prisma.order.upsert({
            create: {
                hash: swap.hash,
                address: swap.address,
                block: swap.block,
                type: OrderType.Swap,
            },
            update: {
                address: swap.address,
            },
            where: {
                hash: swap.hash,
            },
        })));
        console.log("Swap Addresses Complete", getUniqueOrderAddresses(swapEvents).size);
    });
}
exports.processSwapEvents = processSwapEvents;
function getHistoricalOrderStats(blockStart, blockEnd) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentSwapAddresses = yield getUniqueAddressOrderTypeWithBlockInterval(OrderType.Swap, blockStart, blockEnd);
        const pastSwapAddresses = yield getUniqueAddressOrderTypeWithBlockCumulative(OrderType.Swap, blockStart - 1);
        const newSwapAddresses = Array.from(currentSwapAddresses).filter((address) => !pastSwapAddresses.has(address));
        console.log("New Swap Addresses", newSwapAddresses.length);
        const currentMakerAddresses = yield getUniqueAddressOrderTypeWithBlockInterval(OrderType.Maker, blockStart, blockEnd);
        const pastMakerAddresses = yield getUniqueAddressOrderTypeWithBlockCumulative(OrderType.Maker, blockStart - 1);
        const newMakerAddresses = Array.from(currentMakerAddresses).filter((address) => !pastMakerAddresses.has(address));
        console.log("New Maker Addresses", newMakerAddresses.length);
        const currentBatchAddresses = yield getUniqueAddressOrderTypeWithBlockInterval(OrderType.Batch, blockStart, blockEnd);
        const pastBatchAddresses = yield getUniqueAddressOrderTypeWithBlockCumulative(OrderType.Batch, blockStart - 1);
        const newBatchAddresses = Array.from(currentBatchAddresses).filter((address) => !pastBatchAddresses.has(address));
        console.log("New Batch Addresses", newBatchAddresses.length);
        const currentRelativeAddresses = yield getUniqueAddressOrderTypeWithBlockInterval(OrderType.Relative, blockStart, blockEnd);
        const pastRelativeAddresses = yield getUniqueAddressOrderTypeWithBlockCumulative(OrderType.Relative, blockStart - 1);
        const newRelativeAddresses = Array.from(currentRelativeAddresses).filter((address) => !pastRelativeAddresses.has(address));
        console.log("New Relative Addresses", newRelativeAddresses.length);
    });
}
exports.getHistoricalOrderStats = getHistoricalOrderStats;
function processMakerOrders(provider, blockStart, blockEnd) {
    return __awaiter(this, void 0, void 0, function* () {
        const { makerOrders, batchOrders, relativeOrders } = yield getMakerOrders(provider, blockStart, blockEnd);
        const maker = getUniqueOrderAddresses(makerOrders);
        const pastMakerAddresses = yield getUniqueAddressOrderType(OrderType.Maker);
        const newMakerAddresses = Array.from(maker).filter((address) => !pastMakerAddresses.has(address));
        yield updateTasks(TASK_IDS.MAKER, newMakerAddresses);
        console.log("All Maker Addresses Complete:", maker.size);
        console.log("New Maker Addresses Complete: ", newMakerAddresses.length);
        const pastBatch = yield getUniqueAddressOrderType(OrderType.Batch);
        const pastRelative = yield getUniqueAddressOrderType(OrderType.Relative);
        const pastBoth = new Set([
            ...Array.from(pastBatch),
            ...Array.from(pastRelative),
        ]);
        const newBatch = new Set([...getUniqueOrderAddresses(batchOrders)].filter((address) => !pastBoth.has(address)));
        const newRelative = new Set([...getUniqueOrderAddresses(relativeOrders)].filter((address) => !pastBoth.has(address)));
        const newComplete = new Set([
            ...[...newBatch].filter((x) => pastRelative.has(x) || newRelative.has(x)),
            ...[...newRelative].filter((x) => pastBatch.has(x) || newBatch.has(x)),
        ]);
        yield updateTasks(TASK_IDS.ADVANCED, Array.from(newComplete));
        console.log("New Relative Addresses Complete", newRelative.size);
        console.log("New Batch Addresses Complete", newBatch.size);
        console.log("Advanced Order Addresses Complete", newComplete.size);
    });
}
exports.processMakerOrders = processMakerOrders;
function updateMakerOrders(provider) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentBlock = yield provider.getBlockNumber();
        const mostRecentBlock = (yield getMostRecentBlockMaker()) + 1;
        yield processMakerOrders(provider, mostRecentBlock, currentBlock);
    });
}
exports.updateMakerOrders = updateMakerOrders;
function updateSwapOrders(provider) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentBlock = yield provider.getBlockNumber();
        const mostRecentBlock = (yield getMostRecentBlockSwap()) + 1;
        yield processSwapEvents(provider, mostRecentBlock, currentBlock);
    });
}
exports.updateSwapOrders = updateSwapOrders;
function updateAllAdvancedOrders(provider) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentBlock = yield provider.getBlockNumber();
        const batch = yield getUniqueAddressOrderTypeWithBlockInterval(OrderType.Batch, 1048392, currentBlock);
        const relative = yield getUniqueAddressOrderTypeWithBlockInterval(OrderType.Relative, 1048392, currentBlock);
        const both = new Set([...batch, ...relative]);
        yield updateTasks(TASK_IDS.ADVANCED, [...both]);
        console.log("Advanced Order Addresses Complete", both.size);
    });
}
exports.updateAllAdvancedOrders = updateAllAdvancedOrders;
function updateAllMakerOrders(provider) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentBlock = yield provider.getBlockNumber();
        const batch = yield getUniqueAddressOrderTypeWithBlockInterval(OrderType.Batch, 1048392, currentBlock);
        const relative = yield getUniqueAddressOrderTypeWithBlockInterval(OrderType.Relative, 1048392, currentBlock);
        const addresses = yield getUniqueAddressOrderTypeWithBlockInterval(OrderType.Maker, 1048392, currentBlock);
        const newMaker = new Set([...addresses, ...batch, ...relative]);
        yield updateTasks(TASK_IDS.MAKER, [...newMaker]);
        console.log("Maker Addresses Complete", newMaker.size);
    });
}
exports.updateAllMakerOrders = updateAllMakerOrders;
function updateAllSwapOrders(provider) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentBlock = yield provider.getBlockNumber();
        const addresses = yield getUniqueAddressOrderTypeWithBlockInterval(OrderType.Swap, 1048392, currentBlock);
        yield updateTasks(TASK_IDS.SWAP, [...addresses]);
        console.log("Swap Addresses Complete", addresses.size);
    });
}
exports.updateAllSwapOrders = updateAllSwapOrders;
exports.PUBLIC_PROVIDER = "https://rpc.goerli.linea.build";
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const provider = new ethers_1.ethers.JsonRpcProvider(exports.PUBLIC_PROVIDER, 59140);
        const currentBlock = yield provider.getBlockNumber();
        const DATE_BLOCKS = {
            26: 997063,
            27: 1003898,
            28: 1011066,
            29: 1018263,
            7: 1077193,
        };
        const EVENT_START_BLOCK = DATE_BLOCKS[26];
        // const EVENT_END_BLOCK = await getClosestBlock(
        //   "2023-07-03T05:59:59",
        //   provider
        // ); // 1048392
        // console.log(EVENT_END_BLOCK);
    });
}
function correctOrders(provider, orderType) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentBlock = yield provider.getBlockNumber();
        const addresses = yield getUniqueAddressOrderTypeWithBlockCumulative(orderType, currentBlock);
        yield updateTaskReplace(TASK_IDS.SWAP, Array.from(addresses));
    });
}
main()
    .then(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}))
    .catch((e) => __awaiter(void 0, void 0, void 0, function* () {
    console.error(e);
    yield prisma.$disconnect();
    process.exit(1);
}));
//# sourceMappingURL=index.js.map