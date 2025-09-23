// Sui SDK 번들링을 위한 엔트리 파일
import { SuiClient } from '@mysten/sui/client';

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

import { TransactionBlock } from '@mysten/sui.js/transactions';

import { isValidSuiAddress } from '@mysten/sui/utils';

// 니모닉 관련 라이브러리
import * as bip39 from 'bip39';

// Sui 상수 정의
const SUI_TYPE_ARG = '0x2::sui::SUI';

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------

/**
 * 니모닉으로부터 Ed25519 Keypair 파생
 * @param mnemonic BIP-39 니모닉
 * @param accountIndex 기본 0
 */
export function deriveKeypair(mnemonic, accountIndex = 0) {
    // Sui BIP-44 경로: 44'/784'/{accountIndex}'/0'/0'
    const path = `m/44'/784'/${accountIndex}'/0'/0'`;
    return Ed25519Keypair.deriveKeypair(mnemonic, path);
}

/**
 * Keypair에서 개인키(32 bytes) 추출 (Uint8Array → CSV string)
 * SDK 버전에 따라 export() 또는 exportSecretKey()가 존재
 */
export function exportPrivateKey(keypair) {
    console.log('=== EXPORT PRIVATE KEY DEBUG ===');
    console.log('Keypair:', keypair);

    try {
        // 1) getSecretKey() 메서드 사용 (가장 일반적)
        if (typeof keypair.getSecretKey === 'function') {
            const secretKey = keypair.getSecretKey();
            console.log('getSecretKey result:', secretKey);
            console.log(
                'getSecretKey result type:',
                typeof secretKey
            );

            if (typeof secretKey === 'string') {
                console.log('Secret key is a string');

                // SUI 표준 형식이면 그대로 반환
                if (secretKey.startsWith('suiprivkey1')) {
                    console.log(
                        '✅ Found suiprivkey1 format, returning as-is'
                    );
                    return secretKey;
                }

                // 다른 문자열 형식들은 바이트 배열로 변환 후 CSV로 반환
                console.log(
                    'Converting string to bytes for CSV format'
                );
                let bytes;

                // 일반 base64 문자열
                const binaryString = atob(secretKey);
                const arr = new Uint8Array(
                    binaryString.length
                );
                for (
                    let i = 0;
                    i < binaryString.length;
                    i++
                ) {
                    arr[i] = binaryString.charCodeAt(i);
                }
                bytes = arr;

                // 32바이트로 제한 (필요한 경우)
                if (bytes.length > 32) {
                    bytes = bytes.slice(0, 32);
                }

                if (bytes.length !== 32) {
                    throw new Error(
                        `Invalid private key length: ${bytes.length}. Expected 32.`
                    );
                }

                // Uint8Array를 CSV 문자열로 변환
                return Array.from(bytes).join(',');
            } else if (secretKey instanceof Uint8Array) {
                console.log(
                    'Secret key is Uint8Array, converting to CSV'
                );
                let bytes = secretKey;

                // 32바이트로 제한 (필요한 경우)
                if (bytes.length > 32) {
                    bytes = bytes.slice(0, 32);
                }

                if (bytes.length !== 32) {
                    throw new Error(
                        `Invalid private key length: ${bytes.length}. Expected 32.`
                    );
                }

                // Uint8Array를 CSV 문자열로 변환
                return Array.from(bytes).join(',');
            } else if (Array.isArray(secretKey)) {
                console.log(
                    'Secret key is Array, converting to CSV'
                );
                let bytes = Uint8Array.from(secretKey);

                // 32바이트로 제한 (필요한 경우)
                if (bytes.length > 32) {
                    bytes = bytes.slice(0, 32);
                }

                if (bytes.length !== 32) {
                    throw new Error(
                        `Invalid private key length: ${bytes.length}. Expected 32.`
                    );
                }

                // Uint8Array를 CSV 문자열로 변환
                return Array.from(bytes).join(',');
            } else {
                throw new Error(
                    `Unknown secretKey format: ${typeof secretKey}`
                );
            }
        }
        // 2) export() 메서드 시도
        else if (typeof keypair.export === 'function') {
            const exported = keypair.export();
            console.log('Exported keypair:', exported);

            if (exported && exported.privateKey) {
                // 문자열 형태인 경우 먼저 확인
                if (
                    typeof exported.privateKey === 'string'
                ) {
                    // SUI 표준 형식이면 그대로 반환
                    if (
                        exported.privateKey.startsWith(
                            'suiprivkey1'
                        )
                    ) {
                        console.log(
                            '✅ Found suiprivkey1 format in exported.privateKey, returning as-is'
                        );
                        return exported.privateKey;
                    }

                    // base64 문자열일 가능성
                    const bstr = atob(exported.privateKey);
                    const arr = new Uint8Array(bstr.length);
                    for (let i = 0; i < bstr.length; i++)
                        arr[i] = bstr.charCodeAt(i);

                    // 32바이트로 제한
                    let bytes = arr;
                    if (bytes.length > 32) {
                        bytes = bytes.slice(0, 32);
                    }
                    if (bytes.length !== 32) {
                        throw new Error(
                            `Invalid private key length: ${bytes.length}. Expected 32.`
                        );
                    }
                    return Array.from(bytes).join(',');
                } else if (
                    exported.privateKey instanceof
                    Uint8Array
                ) {
                    let bytes = exported.privateKey;
                    if (bytes.length > 32) {
                        bytes = bytes.slice(0, 32);
                    }
                    if (bytes.length !== 32) {
                        throw new Error(
                            `Invalid private key length: ${bytes.length}. Expected 32.`
                        );
                    }
                    return Array.from(bytes).join(',');
                } else if (
                    Array.isArray(exported.privateKey)
                ) {
                    let bytes = Uint8Array.from(
                        exported.privateKey
                    );
                    if (bytes.length > 32) {
                        bytes = bytes.slice(0, 32);
                    }
                    if (bytes.length !== 32) {
                        throw new Error(
                            `Invalid private key length: ${bytes.length}. Expected 32.`
                        );
                    }
                    return Array.from(bytes).join(',');
                } else {
                    throw new Error(
                        `Unknown exported privateKey format: ${typeof exported.privateKey}`
                    );
                }
            } else {
                throw new Error(
                    'Exported keypair has no privateKey property'
                );
            }
        }
        // 3) exportSecretKey() 메서드 시도
        else if (
            typeof keypair.exportSecretKey === 'function'
        ) {
            const secretKey = keypair.exportSecretKey();

            if (
                typeof secretKey === 'string' &&
                secretKey.startsWith('suiprivkey1')
            ) {
                console.log(
                    '✅ Found suiprivkey1 format in exportSecretKey, returning as-is'
                );
                return secretKey;
            }

            let bytes;
            if (secretKey instanceof Uint8Array) {
                bytes = secretKey;
            } else if (Array.isArray(secretKey)) {
                bytes = Uint8Array.from(secretKey);
            } else {
                throw new Error(
                    `Unknown exportSecretKey format: ${typeof secretKey}`
                );
            }

            if (bytes.length > 32) {
                bytes = bytes.slice(0, 32);
            }
            if (bytes.length !== 32) {
                throw new Error(
                    `Invalid private key length: ${bytes.length}. Expected 32.`
                );
            }
            return Array.from(bytes).join(',');
        }
        // 4) 직접 속성 접근
        else if (keypair.secretKey) {
            if (
                typeof keypair.secretKey === 'string' &&
                keypair.secretKey.startsWith('suiprivkey1')
            ) {
                console.log(
                    '✅ Found suiprivkey1 format in keypair.secretKey, returning as-is'
                );
                return keypair.secretKey;
            }

            let bytes;
            if (keypair.secretKey instanceof Uint8Array) {
                bytes = keypair.secretKey;
            } else if (Array.isArray(keypair.secretKey)) {
                bytes = Uint8Array.from(keypair.secretKey);
            } else {
                throw new Error(
                    `Unknown secretKey property format: ${typeof keypair.secretKey}`
                );
            }

            if (bytes.length > 32) {
                bytes = bytes.slice(0, 32);
            }
            if (bytes.length !== 32) {
                throw new Error(
                    `Invalid private key length: ${bytes.length}. Expected 32.`
                );
            }
            return Array.from(bytes).join(',');
        } else if (keypair.privateKey) {
            if (
                typeof keypair.privateKey === 'string' &&
                keypair.privateKey.startsWith('suiprivkey1')
            ) {
                console.log(
                    '✅ Found suiprivkey1 format in keypair.privateKey, returning as-is'
                );
                return keypair.privateKey;
            }

            let bytes;
            if (keypair.privateKey instanceof Uint8Array) {
                bytes = keypair.privateKey;
            } else if (Array.isArray(keypair.privateKey)) {
                bytes = Uint8Array.from(keypair.privateKey);
            } else {
                throw new Error(
                    `Unknown privateKey property format: ${typeof keypair.privateKey}`
                );
            }

            if (bytes.length > 32) {
                bytes = bytes.slice(0, 32);
            }
            if (bytes.length !== 32) {
                throw new Error(
                    `Invalid private key length: ${bytes.length}. Expected 32.`
                );
            }
            return Array.from(bytes).join(',');
        } else {
            throw new Error(
                'No method found to export private key from keypair'
            );
        }
    } catch (error) {
        console.error('Error in exportPrivateKey:', error);
        throw error;
    }
}

/**
 * 니모닉 생성/검증
 */
export const generateMnemonic = () =>
    bip39.generateMnemonic();
export const validateMnemonic = (mnemonic) =>
    bip39.validateMnemonic(mnemonic);

/**
 * 간단한 SuiClient 생성기 (선택)
 */
export function createClient(rpcUrl) {
    return new SuiClient({ url: rpcUrl });
}

/**
 * 전송 파라미터 유효성 검사
 */
export function validateTransfer(recipient, amount) {
    const errors = [];
    if (!recipient || typeof recipient !== 'string')
        errors.push('Invalid recipient address');
    if (!isValidSuiAddress(recipient))
        errors.push('Invalid Sui address format');
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0)
        errors.push('Invalid amount');
    return { isValid: errors.length === 0, errors };
}

// -------------------------------------------------------------
// Core: SUI 송금 (가스에서 split → transfer → signAndExecute)
// -------------------------------------------------------------
/**
 * SUI 전송 (정석 플로우)
 * @param client SuiClient
 * @param keypair Ed25519Keypair
 * @param recipient 수신자 Sui 주소
 * @param amountSui SUI 단위(예: 0.1)
 */
export async function sendSui(
    client,
    keypair,
    recipient,
    amountSui
) {
    // 공개키 상세 디버깅
    let publicKey;
    try {
        publicKey = keypair.getPublicKey();
    } catch (error) {
        console.error('Error getting public key:', error);
        throw error;
    }

    // 주소 생성 상세 디버깅
    let sender;
    try {
        sender = publicKey.toSuiAddress();
    } catch (error) {
        console.error(
            'Error generating Sui address:',
            error
        );
        throw error;
    }

    // 1 SUI = 10^9 Mist
    const mist = BigInt(
        Math.floor(Number(amountSui) * 1e9)
    );
    console.log('Amount in MIST:', mist.toString());

    // (선택) 사전 잔액 체크
    console.log('Checking balance...');
    const bal = await client.getBalance({
        owner: sender,
        coinType: SUI_TYPE_ARG,
    });
    console.log('Balance result:', bal);
    console.log('Total balance:', bal.totalBalance);

    if (BigInt(bal.totalBalance) < mist) {
        throw new Error(
            `잔액 부족: 보유 ${
                bal.totalBalance
            } < 전송 ${mist.toString()} (Mist 단위)`
        );
    }

    console.log(
        'Balance check passed, creating transaction...'
    );

    const tx = new TransactionBlock();
    tx.setSender(sender);

    // ✅ 가스에서 원하는 금액만 분할
    const [coin] = tx.splitCoins(tx.gas, [
        tx.pure.u64(mist),
    ]);
    // ✅ 수신자에게 전송
    tx.transferObjects([coin], tx.pure.address(recipient));

    console.log(
        'Transaction created, signing and executing...'
    );

    // 클라이언트 메서드 디버깅
    console.log('=== CLIENT METHODS DEBUG ===');
    console.log('Client object:', client);
    console.log('Client type:', typeof client);
    console.log(
        'Client constructor:',
        client.constructor.name
    );
    console.log(
        'Available client methods:',
        Object.getOwnPropertyNames(client)
    );
    console.log(
        'Client prototype methods:',
        Object.getOwnPropertyNames(
            Object.getPrototypeOf(client)
        )
    );

    // 사용 가능한 메서드 확인
    const hasSignAndExecuteTransactionBlock =
        typeof client.signAndExecuteTransactionBlock ===
        'function';
    const hasSignAndExecuteTransaction =
        typeof client.signAndExecuteTransaction ===
        'function';
    const hasExecuteTransactionBlock =
        typeof client.executeTransactionBlock ===
        'function';

    console.log('Method availability:', {
        signAndExecuteTransactionBlock:
            hasSignAndExecuteTransactionBlock,
        signAndExecuteTransaction:
            hasSignAndExecuteTransaction,
        executeTransactionBlock: hasExecuteTransactionBlock,
    });

    let res;

    // ✅ 서명 + 실행 (버전별 대응)
    if (hasSignAndExecuteTransactionBlock) {
        console.log(
            'Using signAndExecuteTransactionBlock...'
        );
        res = await client.signAndExecuteTransactionBlock({
            signer: keypair,
            transactionBlock: tx,
            options: {
                showEffects: true,
                showObjectChanges: true,
            },
        });
    } else if (hasSignAndExecuteTransaction) {
        console.log('Using signAndExecuteTransaction...');
        res = await client.signAndExecuteTransaction({
            signer: keypair,
            transaction: tx,
            options: {
                showEffects: true,
                showObjectChanges: true,
            },
        });
    } else if (hasExecuteTransactionBlock) {
        console.log(
            'Using executeTransactionBlock (need to sign first)...'
        );
        // 먼저 트랜잭션에 서명
        const signedTx = await keypair.signTransactionBlock(
            tx
        );
        res = await client.executeTransactionBlock({
            transactionBlock: signedTx,
            options: {
                showEffects: true,
                showObjectChanges: true,
            },
        });
    } else {
        // 모든 메서드가 없는 경우 대체 방법 시도
        console.log(
            'No known transaction methods found, trying alternative approach...'
        );
        throw new Error(
            'No supported transaction execution method found on client. Available methods: ' +
                Object.getOwnPropertyNames(client).join(
                    ', '
                )
        );
    }

    console.log('Transaction executed successfully:', res);
    return res;
}

// -------------------------------------------------------------
// Core: 트랜잭션 히스토리 조회
// -------------------------------------------------------------

/**
 * 주소의 트랜잭션 히스토리 조회 (수정된 버전)
 * @param client SuiClient
 * @param address 조회할 주소
 * @param limit 조회할 트랜잭션 수 (기본값: 20)
 * @param cursor 페이지네이션 커서 (선택사항)
 */
export async function getTransactionHistory(
    client,
    address,
    limit = 20,
    cursor = null
) {
    try {
        console.log('=== BUNDLER: getTransactionHistory called ===');
        console.log(`Fetching transaction history for address: ${address}`);
        console.log(`Limit: ${limit}, Cursor: ${cursor}`);
        console.log('Client:', client);
        
        // 실제 트랜잭션 조회 시작

        // 1단계: FromAddress와 ToAddress 모두에서 트랜잭션 다이제스트 목록 가져오기
        let allDigests = [];
        
        // FromAddress로 보낸 트랜잭션 조회
        const fromAddressOptions = {
            limit: limit * 5, // 적당한 수로 조정
            ...(cursor && { cursor }),
            filter: {
                FromAddress: address
            }
        };

        console.log('FromAddress query options:', fromAddressOptions);

        try {
            const fromAddressResult = await client.queryTransactionBlocks(fromAddressOptions);
            console.log('FromAddress filter result:', fromAddressResult);
            if (fromAddressResult.data && fromAddressResult.data.length > 0) {
                allDigests.push(...fromAddressResult.data);
            }
        } catch (error) {
            console.log('FromAddress filter failed:', error);
        }

        // ToAddress로 받은 트랜잭션 조회
        const toAddressOptions = {
            limit: limit * 5, // 적당한 수로 조정
            ...(cursor && { cursor }),
            filter: {
                ToAddress: address
            }
        };

        console.log('ToAddress query options:', toAddressOptions);

        try {
            const toAddressResult = await client.queryTransactionBlocks(toAddressOptions);
            console.log('ToAddress filter result:', toAddressResult);
            if (toAddressResult.data && toAddressResult.data.length > 0) {
                allDigests.push(...toAddressResult.data);
            }
        } catch (error) {
            console.log('ToAddress filter failed:', error);
        }

        // 중복 제거 (같은 digest가 있을 수 있음)
        const uniqueDigests = allDigests.filter((digest, index, self) => 
            index === self.findIndex(d => d.digest === digest.digest)
        );

        console.log('Combined unique digests:', uniqueDigests);
        console.log('Total unique digests found:', uniqueDigests.length);

        if (uniqueDigests.length === 0) {
            console.log('No transaction digests found');
            return {
                data: [],
                hasNextPage: false,
                nextCursor: null
            };
        }

        // digestResult 형태로 변환
        const digestResult = {
            data: uniqueDigests,
            hasNextPage: false, // 페이지네이션은 나중에 처리
            nextCursor: null
        };
        
        console.log('Digest result:', digestResult);
        console.log('Digest result data length:', digestResult.data?.length);

        if (!digestResult.data || digestResult.data.length === 0) {
            console.log('No transaction digests found');
            return {
                data: [],
                hasNextPage: false,
                nextCursor: null
            };
        }

        // 2단계: 각 다이제스트에 대해 상세 정보 가져오기
        const detailedTxs = [];
        const batchSize = 3; // 한 번에 처리할 트랜잭션 수

        for (let i = 0; i < digestResult.data.length; i += batchSize) {
            const batch = digestResult.data.slice(i, i + batchSize);
            const batchPromises = batch.map(async (txDigest) => {
                try {
                    const txDetail = await client.getTransactionBlock({
                        digest: txDigest.digest,
                        options: {
                            showInput: true,
                            showRawInput: false,
                            showEffects: true,
                            showEvents: true,
                            showObjectChanges: true,
                            showBalanceChanges: true
                        }
                    });
                    return txDetail;
                } catch (error) {
                    console.error(`Error fetching transaction ${txDigest.digest}:`, error);
                    return null;
                }
            });

            const batchResults = await Promise.all(batchPromises);
            detailedTxs.push(...batchResults.filter(tx => tx !== null));
        }

        console.log(`Fetched ${detailedTxs.length} detailed transactions`);
        console.log('Sample transaction structure:', detailedTxs[0]);

        // 3단계: 주소와 관련된 트랜잭션만 필터링 (더 관대한 필터링)
        const filteredTxs = detailedTxs.filter(tx => {
            if (!tx) return false;

            // 트랜잭션의 sender가 주소와 일치하는지 확인
            const sender = tx.transaction?.data?.sender;
            if (sender === address) {
                console.log(`Found transaction with sender: ${tx.digest}`);
                return true;
            }
            
            // 트랜잭션의 recipient가 주소와 일치하는지 확인 (transaction.data.recipient)
            const recipient = tx.transaction?.data?.recipient;
            if (recipient === address) {
                console.log(`Found transaction with recipient: ${tx.digest}`);
                return true;
            }
            
            // 트랜잭션의 gasData에서 sender 확인
            const gasSender = tx.transaction?.data?.gasData?.owner;
            if (gasSender === address) {
                console.log(`Found transaction with gas sender: ${tx.digest}`);
                return true;
            }

            // Object changes에서 주소와 관련된 변경사항이 있는지 확인
            if (tx.objectChanges) {
                for (const change of tx.objectChanges) {
                    // transferred 타입
                    if (change.type === 'transferred') {
                        const recipient = change.recipient?.AddressOwner;
                        if (recipient === address) {
                            console.log(`Found transaction with recipient in objectChanges: ${tx.digest}`);
                            return true;
                        }
                    }
                    // created 타입
                    if (change.type === 'created') {
                        const owner = change.owner?.AddressOwner;
                        if (owner === address) {
                            console.log(`Found transaction with created object for: ${tx.digest}`);
                            return true;
                        }
                    }
                    // mutated 타입
                    if (change.type === 'mutated') {
                        const owner = change.owner?.AddressOwner;
                        if (owner === address) {
                            console.log(`Found transaction with mutated object for: ${tx.digest}`);
                            return true;
                        }
                    }
                }
            }

            // Events에서 주소와 관련된 이벤트가 있는지 확인
            if (tx.events) {
                for (const event of tx.events) {
                    if (event.parsedJson) {
                        const eventData = event.parsedJson;
                        if (eventData.sender === address || eventData.recipient === address) {
                            console.log(`Found transaction with address in events: ${tx.digest}`);
                            return true;
                        }
                    }
                    // sender 필드도 확인
                    if (event.sender === address) {
                        console.log(`Found transaction with sender in event: ${tx.digest}`);
                        return true;
                    }
                }
            }

            // Balance changes에서 주소와 관련된 변경사항이 있는지 확인
            if (tx.balanceChanges) {
                for (const change of tx.balanceChanges) {
                    if (change.owner?.AddressOwner === address) {
                        console.log(`Found transaction with balance change for: ${tx.digest}`);
                        return true;
                    }
                }
            }

            return false;
        });

        console.log(`Filtered ${filteredTxs.length} transactions for address ${address}`);
        
        // 필터링된 트랜잭션들의 digest 출력
        if (filteredTxs.length > 0) {
            console.log('Filtered transaction digests:', filteredTxs.map(tx => tx.digest));
        } else {
            console.log('No transactions found for this address');
        }

        // 시간순으로 정렬 (최신순)
        filteredTxs.sort((a, b) => {
            const timeA = parseInt(a.timestampMs || 0);
            const timeB = parseInt(b.timestampMs || 0);
            return timeB - timeA;
        });

        // limit만큼 잘라내기
        const limitedTxs = filteredTxs.slice(0, limit);

        const finalResult = {
            data: limitedTxs,
            hasNextPage: digestResult.hasNextPage && filteredTxs.length >= limit,
            nextCursor: digestResult.nextCursor
        };

        console.log('Final transaction history:', finalResult);
        console.log('=== BUNDLER: getTransactionHistory completed ===');
        return finalResult;
    } catch (error) {
        console.error('=== BUNDLER: Error fetching transaction history ===', error);
        throw error;
    }
}

/**
 * 특정 트랜잭션 상세 정보 조회
 * @param client SuiClient
 * @param digest 트랜잭션 다이제스트
 */
export async function getTransactionDetails(client, digest) {
    try {
        console.log(`Fetching transaction details for digest: ${digest}`);

        const response = await client.getTransactionBlock({
            digest: digest,
            options: {
                showEffects: true,
                showInput: true,
                showObjectChanges: true,
                showEvents: true,
            },
        });

        console.log('Transaction details response:', response);
        return response;
    } catch (error) {
        console.error('Error fetching transaction details:', error);
        throw error;
    }
}

/**
 * 주소의 모든 트랜잭션 조회 (FromAddress + ToAddress) - 개선된 버전
 * @param client SuiClient
 * @param address 조회할 주소
 * @param limit 조회할 트랜잭션 수 (기본값: 20)
 * @param cursor 페이지네이션 커서 (선택사항)
 */
export async function getAllTransactions(
    client,
    address,
    limit = 20,
    cursor = null
) {
    try {
        console.log(`Fetching all transactions for address: ${address}`);

        // getTransactionHistory를 사용 (이미 FromAddress + ToAddress를 모두 조회함)
        const result = await getTransactionHistory(client, address, limit, cursor);
        
        console.log('All transactions response:', result);
        return result;
    } catch (error) {
        console.error('Error fetching all transactions:', error);
        throw error;
    }
}

/**
 * 트랜잭션 타입별 필터링
 * @param transactions 트랜잭션 배열
 * @param type 필터링할 타입 ('send', 'receive', 'all')
 */
export function filterTransactionsByType(transactions, type = 'all', userAddress = null) {
    if (type === 'all') {
        return transactions;
    }

    if (!userAddress) {
        console.warn('User address not provided for filtering, returning all transactions');
        return transactions;
    }

    return transactions.filter(tx => {
        if (!tx) return false;

        // 트랜잭션의 sender가 사용자 주소와 일치하는지 확인 (보낸 트랜잭션)
        const sender = tx.transaction?.data?.sender;
        const isSend = sender === userAddress;
        
        // 트랜잭션의 recipient가 사용자 주소와 일치하는지 확인 (받은 트랜잭션)
        const recipient = tx.transaction?.data?.recipient;
        const isReceive = recipient === userAddress;
        
        // Balance changes에서 수신 확인
        let hasReceivedSui = false;
        if (tx.balanceChanges) {
            const receivedSui = tx.balanceChanges.find(
                change => change.coinType === '0x2::sui::SUI' && 
                         change.owner?.AddressOwner === userAddress &&
                         Number(change.amount) > 0
            );
            if (receivedSui) {
                hasReceivedSui = true;
            }
        }
        
        // Object changes에서 수신 확인
        let hasReceivedObject = false;
        if (tx.objectChanges) {
            const receivedObject = tx.objectChanges.find(
                change => change.type === 'created' && 
                         change.owner?.AddressOwner === userAddress
            );
            if (receivedObject) {
                hasReceivedObject = true;
            }
        }
        
        // 최종 판단
        const isReceiveTransaction = isReceive || hasReceivedSui || hasReceivedObject;
        
        if (type === 'send') {
            return isSend;
        } else if (type === 'receive') {
            return isReceiveTransaction;
        }
        
        return true;
    });
}

/**
 * 트랜잭션 상태 확인
 * @param transaction 트랜잭션 객체
 */
export function getTransactionStatus(transaction) {
    if (!transaction.effects) {
        return 'unknown';
    }

    const status = transaction.effects.status;
    if (status.status === 'success') {
        return 'success';
    } else if (status.status === 'failure') {
        return 'failed';
    } else {
        return 'pending';
    }
}

/**
 * 트랜잭션 금액 추출 (다양한 토큰 타입 지원)
 * @param transaction 트랜잭션 객체
 * @param address 사용자 주소
 */
export function extractTransactionAmount(transaction, address = null) {
    try {
        if (!transaction) return null;

        // Balance changes에서 금액 추출 (가장 정확함)
        if (transaction.balanceChanges) {
            const suiChanges = transaction.balanceChanges.filter(
                change => change.coinType === '0x2::sui::SUI' && 
                         change.owner?.AddressOwner === address
            );

            if (suiChanges.length > 0) {
                // SUI 잔액 변경사항의 합계 계산
                const totalChange = suiChanges.reduce((sum, change) => {
                    return sum + Number(change.amount);
                }, 0);
                
                // MIST를 SUI로 변환 (1 SUI = 10^9 MIST)
                return totalChange / 1e9;
            }
        }

        // Object changes에서 SUI 전송 찾기
        if (transaction.objectChanges) {
            const coinChanges = transaction.objectChanges.filter(
                change => change.type === 'transferred' && 
                         change.objectType === '0x2::coin::Coin<0x2::sui::SUI>'
            );

            if (coinChanges.length > 0) {
                // 전송된 코인의 양 추출
                const amount = coinChanges[0].amount || coinChanges[0].balance;
                if (amount) {
                    return Number(amount) / 1e9;
                }
            }
        }

        // Events에서 SUI 관련 정보 찾기
        if (transaction.events) {
            for (const event of transaction.events) {
                if (event.parsedJson && event.parsedJson.sui_amount) {
                    return Number(event.parsedJson.sui_amount) / 1e9;
                }
            }
        }

        return null;
    } catch (error) {
        console.error('Error extracting transaction amount:', error);
        return null;
    }
}

// -------------------------------------------------------------
// Sui SDK 객체 생성
// -------------------------------------------------------------
const suiSDK = {
    // SDK
    SuiClient,
    Ed25519Keypair,
    TransactionBlock,
    SUI_TYPE_ARG,
    isValidSuiAddress,
    // Mnemonic
    bip39,
    generateMnemonic,
    validateMnemonic,
    // Helpers
    deriveKeypair,
    exportPrivateKey,
    createClient,
    validateTransfer,
    // Actions
    sendSui,
    // History
    getTransactionHistory,
    getTransactionDetails,
    getAllTransactions,
    filterTransactionsByType,
    getTransactionStatus,
    extractTransactionAmount,
    // Version tag (수동)
    version: 'bundled-1.0.0',
};

// -------------------------------------------------------------
// Public exports
// -------------------------------------------------------------
export {
    SuiClient,
    Ed25519Keypair,
    TransactionBlock,
    SUI_TYPE_ARG,
    isValidSuiAddress,
    bip39,
};

// 기본 내보내기로 suiSDK 제공
export default suiSDK;

// -------------------------------------------------------------
// Global exposure for mini-apps
// -------------------------------------------------------------

// 전역 변수로도 노출 (미니앱에서 사용하기 위해)
if (typeof window !== 'undefined') {
    window.suiSDK = suiSDK;
}

// Node.js 환경에서도 전역으로 노출
if (typeof global !== 'undefined') {
    global.suiSDK = suiSDK;
}
