import { decodeInt, decodeObj, decodeQuery, decodeStr, stringifyTransaction } from "./helpers";
import { I_BroadcastTxResult, I_NetworkSettings, I_SendTxResult, I_Transaction } from "../types";
import { Encoder } from "./encoder";

export class MasternodeAPI {
	hosts: string[];

	constructor(network_settings: I_NetworkSettings) {
		if (typeof network_settings !== "object" || Object.keys(network_settings).length === 0)
			throw new Error(`Expected Object and got Type: ${typeof network_settings}`);
		if (!Array.isArray(network_settings.masternode_hosts) || network_settings.masternode_hosts.length === 0)
			throw new Error(`HOSTS Required (Type: Array)`);
		this.hosts = this.validateHosts(network_settings.masternode_hosts);
	}

	validateProtocol(host: string) {
		let protocols = ["https://", "http://"];
		if (protocols.map((protocol) => host.includes(protocol)).includes(true)) return host;
		throw new Error("Host String must include http:// or https://");
	}

	validateHosts(hosts: string[]) {
		return hosts.map((host) => this.validateProtocol(host.toLowerCase()));
	}

	get host() {
		return this.hosts[Math.floor(Math.random() * this.hosts.length)];
	}

	get url() {
		return this.host;
	}

	async getContractInfo(contractName: string) {
		const response = await fetch(`${this.host}/abci_query?path="/contract/${contractName}"`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
		});
		const data = await response.json();
		return decodeQuery(data.result.response);
	}

	async getVariable(contract: string, variable: string) {
		let path = `/get/${contract}.${variable}/`;
		const url = `${this.host}/abci_query?path="${path}"`;
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
		});
		const data = await response.json();
		const result = data.result.response;
		let decoded = decodeQuery(result);
		return decoded;
	}

	async getContractMethods(contractName) {
		const response = await fetch(`${this.host}/abci_query?path="/contract_methods/${contractName}"`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
		});
		const data = await response.json();
		return JSON.parse(decodeQuery(data.result.response) as string);
	}

	async getContractVariables(contractName) {
		const response = await fetch(`${this.host}/abci_query?path="/contract_vars/${contractName}"`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
		});
		const data = await response.json();
		return JSON.parse(decodeQuery(data.result.response) as string);
	}

	async pingServer() {
		const response = await fetch(`${this.host}/abci_query?path="/ping/"`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
		});
		const data = await response.json();
		return JSON.parse(decodeQuery(data.result.response) as string);
	}

	async getCurrencyBalance(vk: string) {
		let balanceRes = await this.getVariable("currency", `balances:${vk}`);
		if (!balanceRes) return Encoder("bigNumber", 0);
		if (balanceRes) return Encoder("bigNumber", balanceRes);
		return Encoder("bigNumber", balanceRes.toString());
	}

	async contractExists(contractName) {
		const contract = await this.getContractInfo(contractName);
		if (contract) return true;
		return false;
	}

	async broadcastTx(tx: I_Transaction): Promise<I_SendTxResult> {
		const txString = stringifyTransaction(tx);
		const url = `${this.host}/broadcast_tx_commit?tx="${txString}"`;
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});
		const data = await response.json();
		const { check_tx, deliver_tx, hash } = data.result as I_BroadcastTxResult;
		const result_data = deliver_tx.data ? decodeObj(deliver_tx.data) : null;
		const check = check_tx.code === 0;
		const deliver = deliver_tx.code === 0;
		return { success: check && deliver, data: result_data, hash };
	}

	async getNonce(vk: string) {
		const path = `/abci_query?path="/get_next_nonce/${vk}"`;
		const url = `${this.host}${path}`;
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
		});
		const data = await response.json();
		const value = data.result.response.value;
		if (value === "AA==") return 0;
		const decoded = decodeInt(value);
		return decoded;
	}

	getTransaction(hash: string) {
		return fetch(`${this.host}/tx?hash="0x${hash}"`).then(response => response.json());
	}

	getNodeInfo() {
		return fetch(`${this.host}/status`).then(response => response.json());
	}

	async getLastetBlock() {
		const response = await fetch(`${this.host}/block`);
		return response.json();
	}
}
