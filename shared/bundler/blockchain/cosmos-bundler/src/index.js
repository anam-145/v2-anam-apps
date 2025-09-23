// Cosmos SDK 번들링을 위한 엔트리 파일
import {
    StargateClient,
    SigningStargateClient,
    defaultRegistryTypes,
    coins,
    calculateFee,
    GasPrice,
} from '@cosmjs/stargate';
import {
    DirectSecp256k1Wallet,
    DirectSecp256k1HdWallet,
    makeCosmoshubPath,
} from '@cosmjs/proto-signing';
import {
    fromBech32,
    toBech32,
    fromHex,
    toHex,
} from '@cosmjs/encoding';
import {
    Secp256k1,
    sha256,
    ripemd160,
    hmac,
} from '@cosmjs/crypto';
import { Decimal, Uint53, Int53 } from '@cosmjs/math';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import { ECPairFactory } from 'ecpair';
import ecc from '@bitcoinerlab/secp256k1';
import { cosmosQRGenerator } from './qr-generator.js';

// ECC 라이브러리로 BIP32와 ECPair 팩토리 생성
const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

// 전역 Buffer 설정 (브라우저 호환성)
if (typeof window !== 'undefined') {
    window.Buffer = Buffer;
}

// 전역 설정 변수 (나중에 외부에서 설정할 수 있도록)
let chainConfig = null;

// CosmosJS 객체 생성
const CosmosJS = {
    // 기본 클라이언트들
    StargateClient,
    SigningStargateClient,

    // 지갑 관련
    DirectSecp256k1Wallet,
    DirectSecp256k1HdWallet,
    makeCosmoshubPath,

    // 인코딩/디코딩
    fromBech32,
    toBech32,
    fromHex,
    toHex,

    // 암호화
    Secp256k1,
    sha256,
    ripemd160,
    hmac,

    // 수학 연산
    Decimal,
    Uint53,
    Int53,

    // BIP 관련
    bip39,
    bip32,
    ECPair,

    // 유틸리티
    coins,
    calculateFee,
    GasPrice,
    defaultRegistryTypes,

    // 헬퍼 함수들

    // 니모닉 생성
    generateMnemonic: (strength = 128) => {
        return bip39.generateMnemonic(strength);
    },

    // 니모닉 검증
    validateMnemonic: (mnemonic) => {
        return bip39.validateMnemonic(mnemonic);
    },

    // 니모닉으로부터 HD 지갑 생성
    createHdWalletFromMnemonic: async (
        mnemonic,
        path = null
    ) => {
        const config = CosmosJS.getConfig();
        const defaultPath = makeCosmoshubPath(0);
        const hdPath = path || defaultPath;

        return await DirectSecp256k1HdWallet.fromMnemonic(
            mnemonic,
            {
                hdPaths: [hdPath],
            }
        );
    },

    // 니모닉으로부터 개인키 추출
    getPrivateKeyFromMnemonic: async (
        mnemonic,
        path = null
    ) => {
        const config = CosmosJS.getConfig();
        const defaultPath = makeCosmoshubPath(0);
        const hdPath = path || defaultPath;

        // HD 지갑 생성
        const wallet =
            await DirectSecp256k1HdWallet.fromMnemonic(
                mnemonic,
                {
                    hdPaths: [hdPath],
                }
            );

        // 계정 정보 가져오기
        const accounts = await wallet.getAccounts();
        const account = accounts[0];

        // 개인키 추출
        const privateKeyBytes =
            await wallet.getAccountsWithPrivkeys();
        const privateKey = privateKeyBytes[0].privkey;

        return {
            privateKey: toHex(privateKey),
            address: account.address,
            path: hdPath,
            publicKey: toHex(account.pubkey),
        };
    },

    // 니모닉 검증 및 개인키 추출 (간단한 버전)
    extractPrivateKey: async (mnemonic) => {
        try {
            // 니모닉 검증
            if (!CosmosJS.validateMnemonic(mnemonic)) {
                throw new Error(
                    '유효하지 않은 니모닉입니다.'
                );
            }

            // 개인키 추출
            const keyInfo =
                await CosmosJS.getPrivateKeyFromMnemonic(
                    mnemonic
                );

            return {
                success: true,
                data: keyInfo,
                message: '개인키 추출 성공',
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: '개인키 추출 실패',
            };
        }
    },

    // 개인키로부터 지갑 생성
    createWalletFromPrivateKey: async (privateKey) => {
        const config = CosmosJS.getConfig();
        return await DirectSecp256k1Wallet.fromKey(
            fromHex(privateKey),
            config.bech32_prefix
        );
    },

    // 지갑 주소 가져오기
    getWalletAddress: async (wallet) => {
        const accounts = await wallet.getAccounts();
        return accounts[0].address;
    },

    // 잔액 조회
    getBalance: async (client, address) => {
        try {
            const config = CosmosJS.getConfig();
            const baseDenom = config.assets[0].base;
            const balance = await client.getBalance(
                address,
                baseDenom
            );

            // 자산 정보에서 소수점 자릿수 찾기
            const asset = config.assets[0];
            const displayUnit = asset.denom_units.find(
                (unit) => unit.denom === asset.display
            );
            const exponent = displayUnit
                ? displayUnit.exponent
                : 6;

            return {
                amount: balance.amount,
                denom: balance.denom,
                formatted: Decimal.fromAtomics(
                    balance.amount,
                    exponent
                ).toString(),
            };
        } catch (error) {
            console.error('Balance query failed:', error);
            throw error;
        }
    },

    // 거래 내역 조회
    getTransactions: async (
        client,
        address,
        limit = 50
    ) => {
        try {
            const config = CosmosJS.getConfig();
            const baseDenomCfg = config.assets[0].base; // e.g., "uatom"

            // 멀티 코인 문자열 파싱 함수
            function parseCoinList(s) {
                // "1000uatom,2000ufoo" -> [{amount:"1000", denom:"uatom"}, ...]
                return s.split(',').map(x => {
                    const m = x.trim().match(/^(\d+)([a-zA-Z/._-]+)$/);
                    return m ? { amount: m[1], denom: m[2] } : null;
                }).filter(Boolean);
            }

            // 여러 쿼리 방식을 시도 - 보낸 것과 받은 것 모두 조회
            let searchResult = [];
            const txHashes = new Set();
            const combined = [];

            try {
                // 보낸 트랜잭션 조회 (Cosmos SDK v0.45+ 형식)
                const sentTxs = await client.searchTx(
                    `message.sender='${address}'`,
                    limit
                );
                console.log(`[CosmosJS] Found ${sentTxs.length} sent transactions`);

                for (const tx of sentTxs) {
                    if (!txHashes.has(tx.hash)) {
                        txHashes.add(tx.hash);
                        combined.push(tx);
                    }
                }
            } catch (error) {
                console.log('Sender query failed:', error.message);
            }

            try {
                // 받은 트랜잭션 조회 - transfer.recipient
                const receivedTxs = await client.searchTx(
                    `transfer.recipient='${address}'`,
                    limit
                );
                console.log(`[CosmosJS] Found ${receivedTxs.length} received transactions`);

                for (const tx of receivedTxs) {
                    if (!txHashes.has(tx.hash)) {
                        txHashes.add(tx.hash);
                        combined.push(tx);
                    }
                }
            } catch (error) {
                console.log('Recipient query failed:', error.message);

                try {
                    // 대체 쿼리: transfer.sender로도 시도
                    const altSentTxs = await client.searchTx(
                        `transfer.sender='${address}'`,
                        limit
                    );

                    for (const tx of altSentTxs) {
                        if (!txHashes.has(tx.hash)) {
                            txHashes.add(tx.hash);
                            combined.push(tx);
                        }
                    }

                } catch (error2) {
                    console.log('Alternative sender query failed:', error2.message);
                }
            }

            // 최종 결과를 searchResult에 할당
            searchResult = combined;

            // 마지막 시도: 아무것도 못 찾았으면 기본 쿼리
            if (searchResult.length === 0) {
                try {
                    console.log('No results found, trying basic query...');
                    searchResult = await client.searchTx(
                        `"${address}"`,
                        limit
                    );
                } catch (finalError) {
                    console.log('Basic query also failed:', finalError.message);
                }
            }

            console.log('[CosmosJS] Processing transactions:', searchResult.length);

            // Height 기준 내림차순 정렬 (최신 먼저)
            searchResult.sort((a, b) => {
                const heightA = typeof a.height === 'number' ? a.height : parseInt(a.height);
                const heightB = typeof b.height === 'number' ? b.height : parseInt(b.height);
                return heightB - heightA; // 내림차순
            });

            console.log('[CosmosJS] Sorted transactions by height');

            // 블록 시간 조회를 위한 높이 수집
            const uniqueHeights = [...new Set(searchResult.map(tx =>
                typeof tx.height === 'number' ? tx.height : parseInt(tx.height)
            ))].filter(h => !isNaN(h));

            console.log('[CosmosJS] Fetching block times for heights:', uniqueHeights);

            // 블록 시간 캐시
            const blockTimeCache = new Map();

            // 각 높이에 대한 블록 시간 조회 (동시에 최대 5개)
            const chunkSize = 5;
            for (let i = 0; i < uniqueHeights.length; i += chunkSize) {
                const chunk = uniqueHeights.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (height) => {
                    try {
                        const block = await client.getBlock(height);
                        if (block?.header?.time) {
                            blockTimeCache.set(height, block.header.time);
                            console.log(`[CosmosJS] Block ${height} time: ${block.header.time}`);
                        }
                    } catch (e) {
                        console.log(`[CosmosJS] Failed to fetch block ${height}:`, e.message);
                    }
                }));
            }

            return searchResult.map((tx, index) => {
                console.log(`[CosmosJS] Processing TX ${index}:`, {
                    hash: tx.hash,
                    height: tx.height,
                    code: tx.code
                });

                // events에서 송수신 정보 추출
                let fromAddress = '';
                let toAddress = '';
                let amount = '';
                let denom = '';
                let mainFound = false;

                if (Array.isArray(tx.events)) {
                    console.log(`[CosmosJS] TX ${index} has ${tx.events.length} events`);

                    for (const ev of tx.events) {
                        if (ev.type !== 'transfer' || !Array.isArray(ev.attributes)) continue;

                        console.log(`[CosmosJS] Found transfer event with ${ev.attributes.length} attributes`);

                        let tempFrom = '';
                        let tempTo = '';
                        let tempAmt = '';
                        let tempDenom = '';
                        let isMsg0 = false;

                        for (const a of ev.attributes) {
                            const key = a.key;      // CosmosJS already decoded these
                            const value = a.value;  // CosmosJS already decoded these

                            console.log(`[CosmosJS] Transfer attribute: ${key} = ${value}`);

                            if (key === 'msg_index' && value === '0') {
                                isMsg0 = true;
                                console.log(`[CosmosJS] Found msg_index=0`);
                            }
                            if (key === 'recipient' && value.startsWith('cosmos')) {
                                tempTo = value;
                                console.log(`[CosmosJS] Found recipient: ${tempTo}`);
                            }
                            if (key === 'sender' && value.startsWith('cosmos')) {
                                tempFrom = value;
                                console.log(`[CosmosJS] Found sender: ${tempFrom}`);
                            }

                            if (key === 'amount') {
                                const coins = parseCoinList(value);
                                // prefer base denom; else take the first
                                const pick = coins.find(c => c.denom === baseDenomCfg) ?? coins[0];
                                if (pick) {
                                    tempAmt = pick.amount;
                                    tempDenom = pick.denom;
                                    console.log(`[CosmosJS] Found amount: ${tempAmt} ${tempDenom}`);
                                }
                            }
                        }

                        const involvesMe = tempFrom === address || tempTo === address;

                        // selection rule:
                        // 1) if msg_index==0 and involves me -> take it and stop
                        // 2) else if involves me with base denom -> prefer it over previous
                        // 3) else keep the largest base-denom amount seen so far as fallback
                        const shouldUse =
                            (isMsg0 && involvesMe && !mainFound) ||
                            (!mainFound && involvesMe && tempDenom === baseDenomCfg) ||
                            (!mainFound && tempDenom === baseDenomCfg && tempAmt && (!amount || BigInt(tempAmt) > BigInt(amount || '0')));

                        if (shouldUse) {
                            fromAddress = tempFrom || fromAddress;
                            toAddress = tempTo || toAddress;
                            amount = tempAmt || amount;
                            denom = tempDenom || denom;

                            console.log(`[CosmosJS] Using transfer event:`, {
                                from: fromAddress,
                                to: toAddress,
                                amount: amount,
                                denom: denom,
                                msgIndex0: isMsg0,
                                involvesMe: involvesMe
                            });

                            if (isMsg0 && involvesMe) {
                                mainFound = true;
                                break;
                            }
                        }
                    }
                }

                // fallback: read directly from the message body if needed
                if ((!fromAddress || !toAddress || !amount) && tx.tx?.body?.messages?.length) {
                    console.log(`[CosmosJS] TX ${index} fallback: checking messages in body`);
                    const msg = tx.tx.body.messages[0];
                    console.log(`[CosmosJS] Message type:`, msg?.['@type']);

                    if (msg?.['@type'] === '/cosmos.bank.v1beta1.MsgSend') {
                        console.log(`[CosmosJS] MsgSend details:`, {
                            from: msg.from_address,
                            to: msg.to_address,
                            amount: msg.amount
                        });

                        fromAddress = msg.from_address || fromAddress;
                        toAddress = msg.to_address || toAddress;
                        if (msg.amount?.[0]?.amount) {
                            amount = msg.amount[0].amount;
                        }
                        if (msg.amount?.[0]?.denom) {
                            denom = msg.amount[0].denom;
                        }
                    }
                }

                console.log(`[CosmosJS] Final TX ${index} data:`, {
                    from: fromAddress,
                    to: toAddress,
                    amount: amount
                });

                // 블록 시간에서 timestamp 가져오기
                const heightNum = typeof tx.height === 'number' ? tx.height : parseInt(tx.height);
                const blockTime = blockTimeCache.get(heightNum);

                let timestamp = null;
                if (blockTime) {
                    // RFC3339 형식을 Unix timestamp로 변환
                    timestamp = Math.floor(new Date(blockTime).getTime() / 1000);
                } else if (tx.timestamp) {
                    // fallback: tx.timestamp가 있으면 사용
                    if (typeof tx.timestamp === 'string') {
                        timestamp = Math.floor(new Date(tx.timestamp).getTime() / 1000);
                    } else if (typeof tx.timestamp === 'number') {
                        timestamp = tx.timestamp;
                    }
                }

                console.log(`[CosmosJS] TX ${index} timestamp:`, {
                    height: heightNum,
                    blockTime: blockTime,
                    final: timestamp
                });

                return {
                    height:
                        tx.height?.toString?.() ?? tx.height,
                    hash: tx.hash,
                    code: tx.code,
                    gasUsed:
                        tx.gasUsed?.toString?.() ?? tx.gasUsed,
                    gasWanted:
                        tx.gasWanted?.toString?.() ??
                        tx.gasWanted,
                    timestamp: timestamp,
                    events: tx.events,
                    from_address: fromAddress,
                    to_address: toAddress,
                    amount: amount
                };
            });
        } catch (error) {
            console.error(
                'Transaction query failed:',
                error
            );
            throw error;
        }
    },

    // 코인 전송
    sendTokens: async (
        signingClient,
        fromAddress,
        toAddress,
        amount,
        denom = null,
        memo = ''
    ) => {
        try {
            const config = CosmosJS.getConfig();
            const baseDenom =
                denom || config.assets[0].base;
            const feeInfo = config.fees.fee_tokens[0];

            const fee = calculateFee(
                200000,
                GasPrice.fromString(
                    `${feeInfo.average_gas_price}${baseDenom}`
                )
            );

            const result = await signingClient.sendTokens(
                fromAddress,
                toAddress,
                coins(amount, baseDenom),
                fee,
                memo
            );

            return {
                height: result.height,
                hash: result.transactionHash,
                gasUsed: result.gasUsed,
                gasWanted: result.gasWanted,
            };
        } catch (error) {
            console.error('Send tokens failed:', error);
            throw error;
        }
    },

    // 클라이언트 연결
    connectClient: async (rpcUrl) => {
        try {
            return await StargateClient.connect(rpcUrl);
        } catch (error) {
            console.error(
                'Client connection failed:',
                error
            );
            throw error;
        }
    },

    // 서명 클라이언트 연결
    connectSigningClient: async (rpcUrl, wallet) => {
        try {
            return await SigningStargateClient.connectWithSigner(
                rpcUrl,
                wallet
            );
        } catch (error) {
            console.error(
                'Signing client connection failed:',
                error
            );
            throw error;
        }
    },

    // 주소 검증
    validateAddress: (address, prefix = null) => {
        try {
            const config = CosmosJS.getConfig();
            const expectedPrefix =
                prefix || config.bech32_prefix;
            const decoded = fromBech32(address);
            return decoded.prefix === expectedPrefix;
        } catch {
            return false;
        }
    },

    // 토큰 단위 변환 (표시 단위 → 기본 단위)
    displayToBase: (amount) => {
        const config = CosmosJS.getConfig();
        const asset = config.assets[0];
        const displayUnit = asset.denom_units.find(
            (unit) => unit.denom === asset.display
        );
        const exponent = displayUnit
            ? displayUnit.exponent
            : 6;

        return Decimal.fromUserInput(
            amount.toString(),
            exponent
        ).atomics;
    },

    // 토큰 단위 변환 (기본 단위 → 표시 단위)
    baseToDisplay: (amount) => {
        const config = CosmosJS.getConfig();
        const asset = config.assets[0];
        const displayUnit = asset.denom_units.find(
            (unit) => unit.denom === asset.display
        );
        const exponent = displayUnit
            ? displayUnit.exponent
            : 6;

        return Decimal.fromAtomics(
            amount.toString(),
            exponent
        ).toString();
    },

    // 하위 호환성을 위한 별칭
    atomToUatom: (amount) => {
        return CosmosJS.displayToBase(amount);
    },

    uatomToAtom: (amount) => {
        return CosmosJS.baseToDisplay(amount);
    },

    // 설정 관련 메서드들

    // 설정 등록 (외부에서 호출하여 설정을 등록)
    registerConfig: (config) => {
        if (!config) {
            throw new Error('Config is required');
        }

        // 필수 필드 검증
        if (
            !config.chain_id ||
            !config.bech32_prefix ||
            !config.assets ||
            !config.apis
        ) {
            throw new Error(
                'Invalid config: missing required fields'
            );
        }

        chainConfig = config;
        console.log(
            'Config registered successfully:',
            config.chain_name
        );
        return true;
    },

    // 설정 가져오기
    getConfig: () => {
        if (!chainConfig) {
            throw new Error(
                'Config not registered. Call registerConfig() first.'
            );
        }
        return chainConfig;
    },

    // 체인 정보 가져오기
    getChainInfo: () => {
        const config = CosmosJS.getConfig();
        return {
            name: config.chain_name,
            prettyName: config.pretty_name,
            chainId: config.chain_id,
            networkType: config.network_type,
            status: config.status,
            website: config.website,
            bech32Prefix: config.bech32_prefix,
            slip44: config.slip44,
        };
    },

    // 자산 정보 가져오기
    getAssetInfo: () => {
        const config = CosmosJS.getConfig();
        return config.assets[0]; // 첫 번째 자산 반환
    },

    // 수수료 정보 가져오기
    getFeeInfo: () => {
        const config = CosmosJS.getConfig();
        return config.fees.fee_tokens[0]; // 첫 번째 수수료 토큰 반환
    },

    // RPC 엔드포인트 가져오기
    getRpcEndpoints: () => {
        const config = CosmosJS.getConfig();
        return config.apis.rpc;
    },

    // REST 엔드포인트 가져오기
    getRestEndpoints: () => {
        const config = CosmosJS.getConfig();
        return config.apis.rest;
    },

    // gRPC 엔드포인트 가져오기
    getGrpcEndpoints: () => {
        const config = CosmosJS.getConfig();
        return config.apis.grpc;
    },

    // 익스플로러 가져오기
    getExplorers: () => {
        const config = CosmosJS.getConfig();
        return config.explorers;
    },

    // 기본 RPC URL 가져오기 (랜덤으로 선택)
    getDefaultRpcUrl: () => {
        const config = CosmosJS.getConfig();
        const rpcEndpoints = config.apis.rpc;
        // 랜덤으로 RPC 엔드포인트 선택
        const randomIndex = Math.floor(
            Math.random() * rpcEndpoints.length
        );
        return rpcEndpoints[randomIndex].address;
    },

    // 기본 REST URL 가져오기 (첫 번째 REST 엔드포인트)
    getDefaultRestUrl: () => {
        const config = CosmosJS.getConfig();
        const apiEndpoints = config.apis.rest;
        const randomIndex = Math.floor(
            Math.random() * apiEndpoints.length
        );
        return apiEndpoints[randomIndex].address;
    },

    // 기본 RPC URL들 (하위 호환성을 위해 유지)
    rpcUrls: {
        mainnet: 'https://rpc.cosmos.network:26657',
        testnet:
            'https://rpc.sentry-01.theta-testnet.polypore.xyz:26657',
    },

    // QR 코드 생성 관련 메서드들

    // 기본 텍스트를 QR 코드로 변환
    generateQRCode: (text, options) => {
        return cosmosQRGenerator.generateQRCode(
            text,
            options
        );
    },

    // 텍스트를 QR 코드 SVG로 변환
    generateQRCodeSVG: (text, options) => {
        return cosmosQRGenerator.generateQRCodeSVG(
            text,
            options
        );
    },

    // 텍스트를 QR 코드 Canvas로 변환
    generateQRCodeCanvas: (text, canvas, options) => {
        return cosmosQRGenerator.generateQRCodeCanvas(
            text,
            canvas,
            options
        );
    },

    // QR 코드를 파일로 저장
    generateQRCodeFile: (text, filename, options) => {
        return cosmosQRGenerator.generateQRCodeFile(
            text,
            filename,
            options
        );
    },

    // 지갑 주소를 QR 코드로 변환
    generateAddressQRCode: (address, options) => {
        return cosmosQRGenerator.generateAddressQRCode(
            address,
            options
        );
    },

    // 설정을 QR 코드로 변환
    generateConfigQRCode: (config, options) => {
        return cosmosQRGenerator.generateConfigQRCode(
            config,
            options
        );
    },

    // 트랜잭션 데이터를 QR 코드로 변환
    generateTransactionQRCode: (txData, options) => {
        return cosmosQRGenerator.generateTransactionQRCode(
            txData,
            options
        );
    },

    // QR 코드 품질 정보 가져오기
    getQRCodeQualityInfo: (text) => {
        return cosmosQRGenerator.getQRCodeQualityInfo(text);
    },
};

// 전역 변수로도 노출 (미니앱에서 사용하기 위해)
if (typeof window !== 'undefined') {
    window.CosmosJS = CosmosJS;
}

// UMD를 위한 default export
export default CosmosJS;
