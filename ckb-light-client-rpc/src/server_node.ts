import express from 'express';
import bodyParser from 'body-parser';
import {JSONRPCServer} from 'json-rpc-2.0';
import { LightClient, randomSecretKey } from "@nervosnetwork/ckb-light-client-js";
import {
    lightClientGetTransactionsResultFrom,
    LightClientScriptStatus,
    LightClientSetScriptsCommandTo, localNodeFrom, RemoteNode, remoteNodeFrom,
    scriptStatusFrom,
    scriptStatusTo,
} from "./types";
import {
    ClientBlock,
    ClientBlockHeader,
    ClientTransactionResponse, Hex,
    numFrom,
    NumLike,
    numToHex
} from "@ckb-ccc/core";
import {JsonRpcIndexerSearchKeyTransaction} from "@ckb-ccc/core/src/client/jsonRpc/types";
import {JsonRpcTransformers} from "./transformers";
import {JsonRpcIndexerSearchKey, JsonRpcTransaction} from "./jsonRpc";
import {apply} from "@ckb-ccc/core";
import fs from "fs/promises";
import path from "path";
const app = express();
const port = 9000;
let client: LightClient;

// @ts-ignore
BigInt.prototype.toJSON = function () {
    return `0x${this.toString(16)}`
}


const server = new JSONRPCServer();
app.use(express.json({limit: '50000mb'}));
app.use(express.urlencoded({limit: '50000mb'}));


// set_scripts
server.addMethod("set_scripts", async ([scripts, command]: [LightClientScriptStatus[], string?]) => {
    const scripts1 = scripts.map(script => scriptStatusTo(script));
    if (command == undefined) {
        return await client.setScripts(scripts1);
    }
    // @ts-ignore
    const cmd = LightClientSetScriptsCommandTo(command);
    return await client.setScripts(scripts1, cmd);
});
// get_scripts
server.addMethod("get_scripts", async () => {
    const result = await client.getScripts();
    return result.map(script => scriptStatusFrom(script));
});

// send_transaction
server.addMethod("send_transaction", async ([tx]: [JsonRpcTransaction]) => {
    const tx1 = JsonRpcTransformers.transactionTo(tx);
    return await client.sendTransaction(tx1);
})
// estimate_cycles
server.addMethod("estimate_cycles", async ([tx]: [JsonRpcTransaction]) => {
    const tx1 = JsonRpcTransformers.transactionTo(tx);
    return await client.estimateCycles(tx1);
})
// get_tip_header
server.addMethod("get_tip_header", async () => {
    const tipHeader: ClientBlockHeader = await client.getTipHeader();
    return JsonRpcTransformers.blockHeaderFrom(tipHeader);
});
// get_genesis_block
server.addMethod("get_genesis_block", async () => {
    // @ts-ignore
    let  block: ClientBlock = await client.getGenesisBlock();
    // todo fix block data
    return JsonRpcTransformers.blockFrom(block);
});
// get_header
server.addMethod("get_header", async ([block_hash]: [string]) => {
    // @ts-ignore
    let  header: ClientBlockHeader = await client.getHeader(block_hash);
    if (header == null){
        return null
    }
    return JsonRpcTransformers.blockHeaderFrom(header);

});
// get_transaction
server.addMethod("get_transaction", async ([tx_hash]: [string]) => {
    const tx: ClientTransactionResponse = await client.getTransaction(tx_hash);
    if (tx === undefined) {
        return {"cycles": null, "transaction": null, "tx_status": {"block_hash": null, "status": "unknown"}}
    }
    return JsonRpcTransformers.transactionResponseFrom(tx);
});
// fetch_header
server.addMethod("fetch_header", async ([header_hash]: [string]) => {
    // @ts-ignore
    let input = client.fetchHeader(header_hash);
    if (input.status === "fetched") {
        return {status: "fetched", data: JsonRpcTransformers.blockHeaderFrom(input.data)};
    }
    return input
});
// fetch_transaction
server.addMethod("fetch_transaction", async ([tx_hash]: [string]) => {
    // @ts-ignore
    let input = client.fetchTransaction(tx_hash);
    if (input.status === "fetched") {
        return {status: "fetched", data: JsonRpcTransformers.transactionResponseFrom(input.data)};
    }
    return input;
});
// get_peers
server.addMethod("get_peers", async () => {
    return (await client.getPeers() as RemoteNode[]).map(node => remoteNodeFrom(node));
});

// local_node_info
server.addMethod("local_node_info", async () => {
    // @ts-ignore
    return localNodeFrom(await client.localNodeInfo());
});

// get_cells
server.addMethod("get_cells", async ([searchKey, order, limit, afterCursor]: [JsonRpcIndexerSearchKey, string?, NumLike?, Hex?]) => {
    const query = {
        searchKey: JsonRpcTransformers.indexerSearchKeyTo(searchKey),
        order: order ?? undefined,
        limit: apply(numFrom, limit),
        afterCursor: afterCursor ?? undefined
    }
    const cells = await client.getCells(
        query.searchKey,
        query.order,
        query.limit,
        query.afterCursor
    );
    return {last_cursor: cells.lastCursor, objects: cells.cells.length === 0 ? [] : cells.cells.map((cell) => (
                {
                    out_point: JsonRpcTransformers.outPointFrom(cell.outPoint),
                    output: JsonRpcTransformers.cellOutputFrom(cell.cellOutput),
                    output_data: query.searchKey.withData == false ? undefined : cell.outputData,
                    block_number: numToHex(cell.blockNumber),
                    tx_index: numToHex(cell.txIndex)
                }))
    };
});
// get_transactions

server.addMethod("get_transactions", async ([searchKey, order, limit, afterCursor]: [JsonRpcIndexerSearchKeyTransaction, string?, NumLike?, Hex?]) => {
    const query = {
        searchKey: JsonRpcTransformers.indexerSearchKeyTransactionTo(searchKey),
        order: order ?? undefined,
        limit: apply(numFrom, limit),
        afterCursor: afterCursor ?? undefined
    }
    const cells = await client.getTransactions(
        query.searchKey,
        query.order,
        query.limit,
        query.afterCursor
    );
    return lightClientGetTransactionsResultFrom(cells)
});
// get_cells_capacity
server.addMethod("get_cells_capacity", async ([searchKey]: [JsonRpcIndexerSearchKey]) => {
    const query = {
        searchKey: JsonRpcTransformers.indexerSearchKeyTo(searchKey),
    }
    const cellsCapacity = await client.getCellsCapacity(query.searchKey);
    const tipHeader = await client.getTipHeader();
    return {
        block_hash: tipHeader.hash,
        block_number: numToHex(tipHeader.number),
        capacity: cellsCapacity
    }
});

server.addMethod("stop", async () => {
    await client.stop();
});


server.addMethod("start", async () => {
    const config = await fs.readFile(path.resolve(__dirname, '../../dev-config.toml'));
    await client.start({ type: "TestNet", config }, randomSecretKey(), "info", "ws");
});


server.addMethod("new_client", async () => {
    client = new LightClient();
    const config = await fs.readFile(path.resolve(__dirname, '../../dev-config.toml'));
    await client.start({ type: "TestNet", config }, randomSecretKey(), "info", "ws");
    await new Promise((resolve) => setTimeout(resolve, 1000));
});

server.addMethod("new_dev_client", async () => {
    // todo support dev 
    client = new LightClient();
    const config = await fs.readFile(path.resolve(__dirname, '../../dev.toml'));
    const spec = await fs.readFile(path.resolve(__dirname, '../../dev.toml'));
    await client.start({ type: "DevNet", spec,config }, randomSecretKey(), "info", "ws");
    await new Promise((resolve) => setTimeout(resolve, 1000));
});


app.use(bodyParser.json());


app.post('/', async (req, res) => {
    let jsonRPCRequest = req.body;
    console.log('body:', JSON.stringify(jsonRPCRequest));

    if (Array.isArray(jsonRPCRequest)) {
        // Handle batch requests
        const responses = await Promise.all(
            jsonRPCRequest.map((request) => server.receive(request))
        );
        const filteredResponses = responses.filter((response) => response !== undefined);
        res.json(filteredResponses);
    } else {
        // Handle single request
        server
            .receive(jsonRPCRequest)
            .then((jsonRPCResponse) => {
                if (jsonRPCResponse) {
                    res.json(jsonRPCResponse);
                } else {
                    res.sendStatus(204); // No content for notifications
                }
            })
            // @ts-ignore
            .catch((error) => {
                res.status(500).send(error.message);
            });
    }
});

// @ts-ignore

// start service
app.listen(port, async () => {
    client = new LightClient();
    const config = await fs.readFile(path.resolve(__dirname, '../../dev-config.toml'));
    await client.start({ type: "TestNet", config }, randomSecretKey(), "info", "ws");
    console.log(`JSON-RPC server is running at http://localhost:${port}`);
});


