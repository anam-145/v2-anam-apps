// ================================================================
// [BLOCKCHAIN] Adapter Template - Bitcoin 기반
// TODO: 이 파일을 복사하여 새 블록체인용 어댑터를 만드세요
// [BLOCKCHAIN] 표시된 부분을 해당 블록체인에 맞게 수정하세요
// ================================================================

// [BLOCKCHAIN] TODO: 설정 이름 변경 (예: SolanaAdapterConfig, CosmosAdapterConfig)
const BitcoinAdapterConfig = {
  // [BLOCKCHAIN] TODO: 기본 정보 수정
  name: "Bitcoin",        // TODO: 블록체인 이름 (예: "Solana", "Cosmos")
  symbol: "BTC",          // TODO: 코인 심볼 (예: "SOL", "ATOM")
  decimals: 8,            // TODO: 소수점 자리수 (BTC:8, ETH:18, SOL:9)
  
  // 네트워크 설정 (config.js에서 동적으로 가져옴)
  network: {
    get networkName() {
      // TODO: Config 객체명 변경 (window.EthereumConfig, window.SolanaConfig 등)
      return window.BitcoinConfig?.getActiveNetwork() || "testnet4";
    },
    get apiBaseUrl() {
      // TODO: Config 객체명 변경
      return window.BitcoinConfig?.apiBaseUrl || "https://mempool.space/testnet4/api";
    },
    get explorerUrl() {
      // TODO: Config 객체명 변경
      return window.BitcoinConfig?.explorerUrl || "https://mempool.space/testnet4";
    }
  },
  
  // UI 테마 설정
  theme: {
    primaryColor: "#F7931A",   // TODO: 메인 색상 변경
    secondaryColor: "#4D4D4D", // TODO: 보조 색상 변경
    logoText: "Bitcoin",       // TODO: 로고 텍스트 변경
  },
  
  // 트랜잭션 설정 (config.js에서 가져옴)
  transaction: {
    get feeRate() {
      return window.BitcoinConfig?.TRANSACTION?.DEFAULT_FEE_RATE || 10;
    },
    get minAmount() {
      return window.BitcoinConfig?.TRANSACTION?.MIN_AMOUNT_BTC || "0.00000546";
    },
    get confirmationTime() {
      return window.BitcoinConfig?.TRANSACTION?.CONFIRMATION_TIME || 600000;
    }
  },
  
};

// ================================================================
// [BLOCKCHAIN] TODO: 클래스 이름 변경 (예: SolanaAdapter, CosmosAdapter)
// ================================================================

class BitcoinAdapter {
  constructor(config) {
    this.config = config || BitcoinAdapterConfig;
    
    // ================================================================
    // [필수 기능 8] Provider/네트워크 관리
    // ================================================================
    // TODO: RPC Provider 초기화
    // 예시:
    // - Ethereum: this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    // - Solana: this.connection = new Connection(rpcUrl, 'confirmed');
    // - Cosmos: this.client = await SigningStargateClient.connect(rpcUrl);
    // - Sui: this.client = new SuiClient({ url: rpcUrl });
    this.provider = null;
  }

  /**
   * [BLOCKCHAIN] TODO: SDK 초기화 메서드로 변경
   * 예시: initializeSDK(), getClient() 등
   */
  getNetworkObject() {
    // TODO: Config 객체명 변경
    const networkName = window.BitcoinConfig?.getActiveNetwork() || 'testnet4';
    
    // TODO: 번들 객체명 변경 (window.SolanaJS, window.CosmosJS 등)
    // 번들에서 네트워크 객체 가져오기
    if (window.BitcoinJS) {
      if (networkName === 'mainnet') {
        return window.BitcoinJS.networks.bitcoin;
      } else {
        return window.BitcoinJS.networks.testnet;
      }
    }
    
    // 폴백: 기본 testnet
    return { 
      messagePrefix: '\x19Bitcoin Signed Message:\n',
      bech32: 'tb',
      bip32: { public: 0x043587cf, private: 0x04358394 },
      pubKeyHash: 0x6f,
      scriptHash: 0xc4,
      wif: 0xef
    };
  }

  /* ================================================================
   * 1. 지갑 생성 및 관리
   * ================================================================ */

  /**
   * 새 지갑 생성
   */
  async generateWallet() {
    try {
      // ================================================================
      // [필수 기능 1] 니모닉 생성
      // ================================================================
      // TODO: 블록체인별 니모닉 생성 로직 구현
      // 1. 12단어 또는 24단어 니모닉 생성
      // 2. BIP39 표준 준수
      // 3. 엔트로피 생성 및 체크섬 검증
      // 
      // 예시:
      // - Ethereum: const wallet = ethers.Wallet.createRandom();
      //             const mnemonic = wallet.mnemonic.phrase;
      // - Solana: const mnemonic = bip39.generateMnemonic();
      // - Cosmos: const wallet = await DirectSecp256k1HdWallet.generate(12);
      //           const mnemonic = wallet.mnemonic;
      // - Sui: const mnemonic = Ed25519Keypair.generateMnemonic();
      
      // TODO: 번들 객체명 변경
      if (!window.BitcoinJS) {
        throw new Error("Library not loaded");
      }

      // TODO: 필요한 함수들 import 변경
      const { bip39, hdWalletFromMnemonic, generateAddress, networks } = window.BitcoinJS;
      const mnemonic = bip39.generateMnemonic();

      // ================================================================
      // [필수 로직] 니모닉으로부터 주소 유도
      // ================================================================
      // TODO: 니모닉에서 주소 생성 로직 구현
      // 1. 시드 생성 (니모닉 → 시드)
      // 2. HD 지갑 생성 및 키 유도 (BIP44 경로 사용)
      // 3. 주소 생성
      // 
      // 중요: BIP44 경로 사용
      // - Bitcoin: m/44'/0'/0'/0/0
      // - Ethereum: m/44'/60'/0'/0/0
      // - Solana: m/44'/501'/0'/0'
      // - Cosmos: m/44'/118'/0'/0/0
      // - Sui: m/44'/784'/0'/0'/0'
      // 
      // 예시:
      // - Solana: const seed = await bip39.mnemonicToSeed(mnemonic);
      //           const keypair = Keypair.fromSeed(seed.slice(0, 32));
      //           const address = keypair.publicKey.toBase58();
      // - Sui: const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
      //        const address = keypair.getPublicKey().toSuiAddress();
      const mainnetHdWallet = hdWalletFromMnemonic(mnemonic, networks.bitcoin);
      const testnetHdWallet = hdWalletFromMnemonic(mnemonic, networks.testnet);

      const mainnetAddress = generateAddress(mainnetHdWallet, 0, networks.bitcoin);
      const testnetAddress = generateAddress(testnetHdWallet, 0, networks.testnet);

      // 3. 현재 활성 네트워크 확인
      // TODO: Config 객체명 변경
      const currentNetwork = window.BitcoinConfig?.getActiveNetwork() || 'testnet4';

      // 보안: 민감한 정보는 콘솔에 출력하지 않음
      console.log("Wallet generated successfully for both networks");

      return {
        mnemonic: mnemonic,
        networks: {
          mainnet: {
            address: mainnetAddress.address,
            privateKey: mainnetAddress.privateKey
          },
          testnet4: {
            address: testnetAddress.address,
            privateKey: testnetAddress.privateKey
          }
        },
        activeNetwork: currentNetwork,
        // 하위 호환성을 위한 현재 네트워크 정보
        address: currentNetwork === 'mainnet' ? mainnetAddress.address : testnetAddress.address,
        privateKey: currentNetwork === 'mainnet' ? mainnetAddress.privateKey : testnetAddress.privateKey
      };
    } catch (error) {
      console.error("Failed to generate wallet:", error);
      throw error;
    }
  }

  /**
   * 니모닉으로 지갑 복구
   */
  async importFromMnemonic(mnemonic) {
    try {
      // ================================================================
      // [필수 기능 2] 니모닉 복원
      // ================================================================
      // TODO: 니모닉으로부터 지갑 복원 로직 구현
      // 1. 니모닉 유효성 검증 (BIP39 체크섬)
      // 2. 시드 생성 (니모닉 → 시드)
      // 3. HD 지갑 생성 및 키 유도
      // 4. 주소 생성
      // 
      // 예시:
      // - Ethereum: const wallet = ethers.Wallet.fromMnemonic(mnemonic);
      //             return { address: wallet.address, privateKey: wallet.privateKey };
      // - Solana: const seed = bip39.mnemonicToSeedSync(mnemonic);
      //           const keypair = Keypair.fromSeed(seed.slice(0, 32));
      //           return { address: keypair.publicKey.toBase58(), privateKey: ... };
      // - Cosmos: const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic);
      //           const [account] = await wallet.getAccounts();
      //           return { address: account.address, ... };
      
      if (!window.BitcoinJS) {
        throw new Error("Bitcoin library not loaded");
      }

      const { hdWalletFromMnemonic, generateAddress, networks, validateMnemonic } = window.BitcoinJS;

      // 니모닉 유효성 검증 추가
      if (!validateMnemonic(mnemonic)) {
        throw new Error("Invalid mnemonic phrase. Please check your recovery phrase and try again.");
      }

      // 양쪽 네트워크 주소 동시 생성
      const mainnetHdWallet = hdWalletFromMnemonic(mnemonic, networks.bitcoin);
      const testnetHdWallet = hdWalletFromMnemonic(mnemonic, networks.testnet);

      const mainnetAddress = generateAddress(mainnetHdWallet, 0, networks.bitcoin);
      const testnetAddress = generateAddress(testnetHdWallet, 0, networks.testnet);

      // 현재 활성 네트워크 확인
      const currentNetwork = window.BitcoinConfig?.getActiveNetwork() || 'testnet4';


      return {
        mnemonic: mnemonic,
        networks: {
          mainnet: {
            address: mainnetAddress.address,
            privateKey: mainnetAddress.privateKey
          },
          testnet4: {
            address: testnetAddress.address,
            privateKey: testnetAddress.privateKey
          }
        },
        activeNetwork: currentNetwork,
        // 하위 호환성을 위한 현재 네트워크 정보
        address: currentNetwork === 'mainnet' ? mainnetAddress.address : testnetAddress.address,
        privateKey: currentNetwork === 'mainnet' ? mainnetAddress.privateKey : testnetAddress.privateKey
      };
    } catch (error) {
      console.error("Failed to import from mnemonic:", error);
      throw error;
    }
  }


  /**
   * 주소 유효성 검증
   */
  isValidAddress(address) {
    return window.BitcoinConfig?.isValidAddress(address) || false;
  }

  /* ================================================================
   * 2. 잔액 조회
   * ================================================================ */

  /**
   * 잔액 조회
   */
  async getBalance(address) {
    try {
      // ================================================================
      // [필수 기능 5] 잔액 조회
      // ================================================================
      // TODO: 블록체인별 잔액 조회 로직 구현
      // 1. RPC 엔드포인트 또는 API 호출
      // 2. 네이티브 토큰 잔액 조회
      // 3. Wei/Lamports/Satoshi 등 최소 단위로 반환
      // 4. 캐싱 전략 적용 (30초 TTL)
      // 
      // 예시:
      // - Ethereum: const balance = await provider.getBalance(address);
      //             return balance.toString(); // Wei 단위
      // - Solana: const balance = await connection.getBalance(new PublicKey(address));
      //           return balance.toString(); // Lamports 단위
      // - Cosmos: const balance = await client.getBalance(address, 'uatom');
      //           return balance.amount; // uatom 단위
      // - Sui: const balance = await client.getBalance({ owner: address });
      //        return balance.totalBalance;
      const url = window.BitcoinConfig?.getApiUrl(`/address/${address}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.status}`);
      }

      const data = await response.json();
      
      // chain_stats.funded_txo_sum - chain_stats.spent_txo_sum = 잔액
      const balance = (data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum).toString();
      
      // 보안: 주소 일부만 표시
      const shortAddress = address.slice(0, 6) + '...' + address.slice(-4);
      console.log(`Balance for ${shortAddress}:`, balance, 'satoshi');
      return balance;
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw error;
    }
  }

  /**
   * UTXO 조회
   */
  async getUTXOs(address) {
    try {
      const url = window.BitcoinConfig?.getApiUrl(`/address/${address}/utxo`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch UTXOs: ${response.status}`);
      }

      const utxos = await response.json();
      
      // 보안: 주소 일부만 표시
      const shortAddr = address.slice(0, 6) + '...' + address.slice(-4);
      console.log(`UTXOs for ${shortAddr}:`, utxos.length, 'unspent outputs');
      
      // BitcoinJS 형식으로 변환
      return utxos.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        status: utxo.status
      }));
    } catch (error) {
      console.error('Failed to get UTXOs:', error);
      throw error;
    }
  }

  /* ================================================================
   * 3. 트랜잭션 처리
   * ================================================================ */

  /**
   * 트랜잭션 전송
   */
  async sendTransaction(params) {
    const { to, amount, privateKey, feeRate } = params;

    try {
      if (!window.BitcoinJS) {
        throw new Error("Bitcoin library not loaded");
      }

      const { ECPair, Psbt, payments } = window.BitcoinJS;
      const network = this.getNetworkObject();

      // ================================================================
      // [필수 로직] 개인키로부터 키페어 생성
      // ================================================================
      // TODO: 개인키로부터 키페어 생성 로직 구현
      // 1. 개인키 형식 검증 (16진수, Base58 등)
      // 2. 키페어 객체 생성
      // 3. 공개키 유도
      // 4. 서명 가능한 객체 반환
      // 
      // 예시:
      // - Ethereum: const wallet = new ethers.Wallet(privateKey);
      // - Solana: const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
      // - Cosmos: const wallet = await Secp256k1Wallet.fromKey(Buffer.from(privateKey, 'hex'));
      // - Sui: const keypair = Ed25519Keypair.fromSecretKey(privateKey);
      const keyPair = ECPair.fromWIF(privateKey, network);
      const { address: fromAddress } = payments.p2wpkh({
        pubkey: keyPair.publicKey,
        network: network,
      });

      // 2. UTXO 조회
      const utxos = await this.getUTXOs(fromAddress);
      if (utxos.length === 0) {
        throw new Error("No available UTXOs");
      }

      // ================================================================
      // [필수 기능 3] 트랜잭션 전송
      // ================================================================
      // TODO: 블록체인별 트랜잭션 생성 및 전송 로직 구현
      // 1. 트랜잭션 객체 생성
      //    - to: 수신 주소
      //    - amount: 전송 금액 (최소 단위)
      //    - fee/gas: 수수료 계산
      // 2. 트랜잭션 서명
      //    - 개인키로 서명 생성
      // 3. 트랜잭션 브로드캐스트
      //    - RPC 노드로 전송
      // 4. Pending TX 관리
      //    - localStorage에 pending TX 저장
      //    - 상태 추적을 위한 폴링 시작
      // 
      // 예시:
      // - Ethereum: const tx = { to, value: parseEther(amount), gasPrice, gasLimit };
      //             const signedTx = await wallet.sendTransaction(tx);
      //             return signedTx.hash;
      // - Solana: const transaction = new Transaction().add(
      //             SystemProgram.transfer({ fromPubkey, toPubkey, lamports })
      //           );
      //           const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);
      // - Cosmos: const result = await client.sendTokens(
      //             fromAddress, toAddress, [{ denom: 'uatom', amount }], fee
      //           );
      
      // 3. 금액 변환 (BTC -> satoshi)
      // TODO: Utils 객체명 변경 (window.EthereumUtils, window.SolanaUtils 등)
      const amountSatoshi = window.BitcoinUtils?.btcToSatoshi(amount) || Math.floor(parseFloat(amount) * 100000000);
      const feeRateSatPerByte = feeRate || this.config.transaction.feeRate;
      
      // 디버깅 로그 추가
      console.log("BitcoinAdapter sendTransaction:", {
        amount: amount,
        amountSatoshi: amountSatoshi,
        feeRate: feeRateSatPerByte,
        btcToSatoshi: window.BitcoinUtils?.btcToSatoshi,
        calculateDustLimit: window.BitcoinUtils?.calculateDustLimit
      });
      
      // 동적 Dust limit 계산 및 검증
      // TODO: Utils 객체명 변경
      const dustLimit = window.BitcoinUtils?.calculateDustLimit(feeRateSatPerByte) || 546;
      
      console.log("Dust limit check:", {
        dustLimit: dustLimit,
        amountSatoshi: amountSatoshi,
        willFail: amountSatoshi < dustLimit
      });
      
      if (amountSatoshi < dustLimit) {
        const dustBTC = (dustLimit / 100000000).toFixed(8);
        throw new Error(`Amount below dust limit. Minimum is ${dustBTC} BTC`);
      }

      // 4. UTXO 선택
      const { utxos: selectedUTXOs, totalValue, fee, change } = 
        window.BitcoinUtils?.selectUTXOs(utxos, amountSatoshi, feeRateSatPerByte) ||
        this.selectUTXOsSimple(utxos, amountSatoshi, feeRateSatPerByte);

      // 5. 수수료 포함 잔액 검증
      const totalNeeded = amountSatoshi + fee;
      if (totalValue < totalNeeded) {
        throw new Error(`Insufficient funds. Need ${totalNeeded} satoshi (amount: ${amountSatoshi}, fee: ${fee}), have ${totalValue} satoshi`);
      }

      // 6. PSBT 생성
      const psbt = new Psbt({ network });

      // 6. Input 추가
      for (const utxo of selectedUTXOs) {
        // 트랜잭션 정보 가져오기
        const txHexUrl = window.BitcoinConfig?.getApiUrl(`/tx/${utxo.txid}/hex`);
        const txResponse = await fetch(txHexUrl);
        const txHex = await txResponse.text();

        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: payments.p2wpkh({ pubkey: keyPair.publicKey, network }).output,
            value: utxo.value,
          },
        });
      }

      // 7. Output 추가
      psbt.addOutput({
        address: to,
        value: amountSatoshi,
      });

      // 8. 거스름돈 추가 (동적 dust limit 체크)
      const changeDustLimit = window.BitcoinUtils?.calculateDustLimit(feeRateSatPerByte) || 546;
      if (change > changeDustLimit) {
        psbt.addOutput({
          address: fromAddress,
          value: change,
        });
      }

      // 9. 서명
      psbt.signAllInputs(keyPair);
      psbt.finalizeAllInputs();

      // 10. 트랜잭션 추출
      const tx = psbt.extractTransaction();
      const txHex = tx.toHex();

      // ================================================================
      // [필수 로직] 트랜잭션 브로드캐스트
      // ================================================================
      // TODO: 서명된 트랜잭션을 네트워크에 브로드캐스트
      // 1. RPC 엔드포인트로 전송
      // 2. 트랜잭션 해시 반환
      // 3. 에러 처리 (네트워크 오류, 잔액 부족 등)
      // 
      // 예시:
      // - Ethereum: const response = await provider.sendTransaction(signedTx);
      //             return response.hash;
      // - Solana: const signature = await connection.sendTransaction(transaction, [keypair]);
      //           return signature;
      // - Cosmos: const result = await client.broadcastTx(txBytes);
      //           return result.transactionHash;
      // - Sui: const result = await client.signAndExecuteTransactionBlock({...});
      //        return result.digest;
      const broadcastUrl = window.BitcoinConfig?.getApiUrl('/tx');
      const broadcastResponse = await fetch(broadcastUrl, {
        method: 'POST',
        body: txHex,
        headers: { 'Content-Type': 'text/plain' }
      });

      if (!broadcastResponse.ok) {
        throw new Error(`Broadcast failed: ${broadcastResponse.status}`);
      }

      const txId = await broadcastResponse.text();
      console.log("Transaction sent successfully");

      return {
        hash: txId,
        fee: fee.toString(),
      };
    } catch (error) {
      console.error("Failed to send transaction:", error);
      throw error;
    }
  }

  /**
   * 간단한 UTXO 선택 (helpers가 없을 경우 폴백)
   */
  selectUTXOsSimple(utxos, targetAmount, feeRate) {
    const sorted = [...utxos].sort((a, b) => b.value - a.value);
    const selected = [];
    let total = 0;
    
    for (const utxo of sorted) {
      selected.push(utxo);
      total += utxo.value;
      
      const estimatedFee = selected.length * 148 * feeRate;
      if (total >= targetAmount + estimatedFee) {
        return {
          utxos: selected,
          totalValue: total,
          fee: estimatedFee,
          change: total - targetAmount - estimatedFee
        };
      }
    }
    
    throw new Error('Insufficient funds');
  }


  /**
   * 현재 블록 높이 조회
   */
  async getBlockHeight() {
    try {
      const url = window.BitcoinConfig?.getApiUrl('/blocks/tip/height');
      const response = await fetch(url);
      return parseInt(await response.text());
    } catch (error) {
      console.error('Failed to get block height:', error);
      return 0;
    }
  }

  /* ================================================================
   * 4. 수수료 관련
   * ================================================================ */

  /**
   * 현재 네트워크 수수료 조회
   */
  async getGasPrice() {
    try {
      const url = window.BitcoinConfig?.getApiUrl('/v1/fees/recommended');
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch fee rates: ${response.status}`);
      }

      const fees = await response.json();

      return {
        low: fees.hourFee.toString(),      // ~60분
        medium: fees.halfHourFee.toString(), // ~30분
        high: fees.fastestFee.toString(),   // 다음 블록
      };
    } catch (error) {
      console.error('Failed to get fee rates:', error);
      // 폴백 값
      return {
        low: "5",
        medium: "10",
        high: "20",
      };
    }
  }

}

// ================================================================
// 전역 설정
// ================================================================

// 설정 접근자
window.CoinConfig = BitcoinAdapterConfig;

// 어댑터 설정
window.setAdapter = (adapter) => {
  window.adapter = adapter;
};

window.getAdapter = () => {
  return window.adapter;
};

// [BLOCKCHAIN] TODO: 어댑터 인스턴스 이름 변경
// 예시: const solanaAdapter = new SolanaAdapter(SolanaAdapterConfig);
const bitcoinAdapter = new BitcoinAdapter(BitcoinAdapterConfig);
window.setAdapter(bitcoinAdapter);

// [BLOCKCHAIN] TODO: 로그 메시지 변경
console.log('[BitcoinAdapter] Module loaded');
console.log('[BitcoinAdapter] Network:', window.BitcoinConfig?.getActiveNetwork());