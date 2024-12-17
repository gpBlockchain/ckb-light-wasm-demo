import {BytesLike, CellOutputLike, hashTypeFrom, Num, numFrom, OutPointLike, Transaction} from "@ckb-ccc/core";
import {Hex} from "@ckb-ccc/core";
import {hexFrom} from "@ckb-ccc/core";
import {numToHex} from "@ckb-ccc/core";
import {ClientBlockHeader} from "@ckb-ccc/core";
import {ScriptLike} from "@ckb-ccc/core";
import {JsonRpcBlockHeader, JsonRpcScript, JsonRpcTransaction} from "./jsonRpc";
import {JsonRpcTransformers} from "./transformers";


interface WorkerInitializeOptions {
    inputBuffer: SharedArrayBuffer;
    outputBuffer: SharedArrayBuffer;
    logLevel: string;
}

interface CellWithBlockNumAndTxIndex {
    outPoint: OutPointLike;
    cellOutput: CellOutputLike;
    outputData: BytesLike;
    blockNumber: Num;
    txIndex: Num;
};

interface DbWorkerInitializeOptions extends WorkerInitializeOptions {
}

interface LightClientWorkerInitializeOptions extends WorkerInitializeOptions {
    networkFlag: NetworkSetting;
};

interface LightClientFunctionCall {
    name: string;
    args: any[];
};

type FetchResponse<T> =
    { status: "fetched"; data: T; } |
    { status: "fetching"; first_sent: bigint; } |
    { status: "added"; timestamp: bigint; } |
    { status: "not_found" };

export function transformFetchResponse<A, B>(input: FetchResponse<A>, fn: (arg: A) => B): FetchResponse<B> {
    if (input.status === "fetched") {
        return {status: "fetched", data: fn(input.data)};
    }
    return input;
}

type JsonRpcScriptType = "lock" | "type";

interface LightClientScriptStatus {
    script: JsonRpcScript;
    script_type: JsonRpcScriptType;
    block_number: Hex;
}

interface ScriptStatus {
    script: ScriptLike,
    scriptType: JsonRpcScriptType,
    blockNumber: Num
}

export function scriptStatusTo(input: LightClientScriptStatus): ScriptStatus {
    return ({
        blockNumber: numFrom(input.block_number),
        script: {
            codeHash: input.script.code_hash,
            args: input.script.args,
            hashType: input.script.hash_type
        },
        scriptType: input.script_type
    })
}

export function scriptStatusFrom(input: ScriptStatus): LightClientScriptStatus {

    return ({
        block_number: numToHex(input.blockNumber),
        script: {
            code_hash: hexFrom(input.script.codeHash),
            args: hexFrom(input.script.args),
            hash_type: hashTypeFrom(input.script.hashType)
        },
        script_type: input.scriptType
    })
}

interface NodeAddress {
    address: string;
    score: Num;
}

interface RemoteNodeProtocol {
    id: Num;
    version: string;
}

interface LightClientPeerSyncState {
    requested_best_known_header?: JsonRpcBlockHeader;
    proved_best_known_header?: JsonRpcBlockHeader;
}

interface PeerSyncState {
    requestedBestKnownHeader?: ClientBlockHeader;
    provedBestKnownHeader?: ClientBlockHeader;
}

export function peerSyncStateTo(input: LightClientPeerSyncState): PeerSyncState {
    return {
        requestedBestKnownHeader: input.requested_best_known_header && JsonRpcTransformers.blockHeaderTo(input.requested_best_known_header),
        provedBestKnownHeader: input.proved_best_known_header && JsonRpcTransformers.blockHeaderTo(input.proved_best_known_header),
    };
}

export function peerSyncStateFrom(input: PeerSyncState ): LightClientPeerSyncState {
    return {
        requested_best_known_header : input.requestedBestKnownHeader && JsonRpcTransformers.blockHeaderFrom(input.requestedBestKnownHeader),
        proved_best_known_header: input.provedBestKnownHeader && JsonRpcTransformers.blockHeaderFrom(input.provedBestKnownHeader),
    };
}

interface LightClientRemoteNode {
    version: string;
    node_id: string;
    addresses: NodeAddress[];
    connected_duration: Num;
    sync_state?: LightClientPeerSyncState;
    protocols: RemoteNodeProtocol[];

}

interface RemoteNode {
    version: string;
    nodeId: string;
    addresses: NodeAddress[];
    connestedDuration: Num;
    syncState?: PeerSyncState;
    protocols: RemoteNodeProtocol[];
}

export function remoteNodeTo(input: LightClientRemoteNode): RemoteNode {
    return ({
        addresses: input.addresses,
        connestedDuration: input.connected_duration,
        nodeId: input.node_id,
        protocols: input.protocols,
        version: input.version,
        syncState: input.sync_state && peerSyncStateTo(input.sync_state)
    })
}


export function remoteNodeFrom(input: RemoteNode): LightClientRemoteNode {
    return ({
        addresses: input.addresses,
        connected_duration : input.connestedDuration,
        node_id: input.nodeId,
        protocols: input.protocols,
        version: input.version,
        sync_state: input.syncState && peerSyncStateFrom(input.syncState)
    })
}

interface LightClientLocalNodeProtocol {
    id: Num;
    name: string;
    support_version: string[];
}


interface LocalNodeProtocol {
    id: Num;
    name: string;
    supportVersion: string[];
}

export function localNodeProtocolTo(input: LightClientLocalNodeProtocol): LocalNodeProtocol {
    return ({
        id: input.id,
        name: input.name,
        supportVersion: input.support_version
    })
}

export function localNodeProtocolFrom(input: LocalNodeProtocol):  LightClientLocalNodeProtocol {
    return ({
        id: input.id,
        name: input.name,
        support_version: input.supportVersion
    })
}

interface LightClientLocalNode {
    version: string;
    node_id: string;
    active: boolean;
    addresses: NodeAddress[];
    protocols: LightClientLocalNodeProtocol[];
    connections: Num;
}

interface LocalNode {
    version: string;
    nodeId: string;
    active: boolean;
    addresses: NodeAddress[];
    protocols: LocalNodeProtocol[];
    connections: bigint;
}

export function localNodeTo(input: LightClientLocalNode): LocalNode {
    return ({
        nodeId: input.node_id,
        protocols: input.protocols.map(x => localNodeProtocolTo(x)),
        active: input.active,
        addresses: input.addresses,
        connections: input.connections,
        version: input.version
    })
}

export function localNodeFrom(input: LocalNode): LightClientLocalNode {
    return ({
        node_id: input.nodeId,
        protocols: input.protocols.map(x => localNodeProtocolFrom(x)),
        active: input.active,
        addresses: input.addresses,
        connections: input.connections,
        version: input.version
    })
}

type NetworkSetting = { type: "MainNet"; config?: string; } | { type: "TestNet"; config?: string; } | {
    type: "DevNet";
    spec: string;
    config: string;
};

export enum LightClientSetScriptsCommand {
    All = 0,
    Partial = 1,
    Delete = 2,
}


export enum LightClientOrder {
    Desc = 0,
    Asc = 1,
}

export function cccOrderToLightClientWasmOrder(input: "asc" | "desc"): LightClientOrder {
    if (input === "asc") return LightClientOrder.Asc;
    else return LightClientOrder.Desc;
}

export function LightClientSetScriptsCommandTo(input: "all" | "partial" | "delete"): LightClientSetScriptsCommand {
    if (input === "all") return LightClientSetScriptsCommand.All;
    if (input === "partial") return LightClientSetScriptsCommand.Partial;
    else return LightClientSetScriptsCommand.Delete;
}


type LightClientCellType = "input" | "output";

interface LightClientTxWithCell {
    transaction: JsonRpcTransaction;
    block_number: Hex;
    tx_index: Hex;
    io_index: Hex;
    io_type: LightClientCellType;
}

interface LightClientTxWithCells {
    transaction: JsonRpcTransaction;
    block_number: Hex;
    tx_index: Hex;
    cells: Array<[LightClientCellType, Hex]>;
}

interface TxWithCell {
    transaction: Transaction;
    blockNumber: Num;
    txIndex: Num;
    ioIndex: Num;
    ioType: LightClientCellType;
}

interface TxWithCells {
    transaction: Transaction;
    blockNumber: Num;
    txIndex: Num;
    cells: Array<[LightClientCellType, number]>
}

interface LightClientPagination<T> {
    objects: T[];
    last_cursor: string;

}

interface GetTransactionsResponse<T> {
    transactions: T[];
    lastCursor: string;
}

export function lightClientGetTransactionsResultFrom(input: GetTransactionsResponse<TxWithCell> | GetTransactionsResponse<TxWithCells>): LightClientPagination<LightClientTxWithCell> | LightClientPagination<LightClientTxWithCells> {

    if (input.transactions.length === 0) {
        return ({
            last_cursor: input.lastCursor,
            objects: []
        })
    }
    if ("ioIndex" in input.transactions[0]) {
        return ({
            last_cursor: input.lastCursor,
            objects: (input as GetTransactionsResponse<TxWithCell>).transactions.map((item) => ({
                transaction: JsonRpcTransformers.transactionFrom(item.transaction),
                block_number: numToHex(item.blockNumber),
                tx_index: numToHex(item.txIndex),
                io_index: numToHex(item.ioIndex),
                io_type: item.ioType
            }))
        }) as LightClientPagination<LightClientTxWithCell>
    } else {
        return ({
            last_cursor: input.lastCursor,
            objects: (input as GetTransactionsResponse<TxWithCells>).transactions.map((item) => ({
                transaction: JsonRpcTransformers.transactionFrom(item.transaction),
                block_number: numToHex(item.blockNumber),
                tx_index: numToHex(item.txIndex),
                cells: item.cells.map(cell => [cell[0], numToHex(cell[1])])
            }))
        }) as LightClientPagination<LightClientTxWithCells>
    }
}


export type {
    LightClientFunctionCall,
    WorkerInitializeOptions,
    DbWorkerInitializeOptions,
    LightClientWorkerInitializeOptions,
    FetchResponse,
    LightClientScriptStatus,
    ScriptStatus,
    LightClientRemoteNode,
    RemoteNode,
    LocalNode,
    LightClientLocalNode,
    NetworkSetting,
    LightClientTxWithCell,
    LightClientTxWithCells,
    TxWithCell,
    TxWithCells,
    GetTransactionsResponse,
}
