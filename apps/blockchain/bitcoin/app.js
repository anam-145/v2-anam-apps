// ================================================================
// Bitcoin Adapter 구현
// BitcoinAdapter 클래스만 포함 (공통 코드는 템플릿 참조)
// ================================================================

// Bitcoin 어댑터 설정 (네트워크 설정은 utils/config.js에서 가져옴)
const BitcoinAdapterConfig = {
  // 기본 정보
  name: "Bitcoin",
  symbol: "BTC",
  decimals: 8, // Bitcoin은 8 decimals (1 BTC = 100,000,000 satoshi)
  
  // 네트워크 설정 (config.js에서 동적으로 가져옴)
  network: {
    get networkName() {
      return window.BitcoinConfig?.getActiveNetwork() || "testnet4";
    },
    get apiBaseUrl() {
      return window.BitcoinConfig?.apiBaseUrl || "https://mempool.space/testnet4/api";
    },
    get explorerUrl() {
      return window.BitcoinConfig?.explorerUrl || "https://mempool.space/testnet4";
    }
  },
  
  // UI 테마 설정
  theme: {
    primaryColor: "#F7931A", // 비트코인 오렌지
    secondaryColor: "#4D4D4D", // 비트코인 그레이
    logoText: "Bitcoin",
  },
  
  // 주소 설정
  address: {
    // 주소 형식 정규식 (Legacy, SegWit, Native SegWit 지원)
    regex: /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59}|tb1[a-z0-9]{39,59})$/,
    // 주소 표시 형식
    displayFormat: "bc1...", // Native SegWit 형식
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
  
  // 기타 옵션
  options: {
    // 니모닉 지원 여부
    supportsMnemonic: true,
    // 토큰 지원 여부
    supportsTokens: false,
    // QR 코드 지원
    supportsQRCode: true,
  },
};

// ================================================================
// BitcoinAdapter 클래스 구현
// ================================================================

class BitcoinAdapter {
  constructor(config) {
    this.config = config || BitcoinAdapterConfig;
  }

  /**
   * 네트워크 객체 가져오기 (bitcoinjs-lib용)
   */
  getNetworkObject() {
    const networkName = window.BitcoinConfig?.getActiveNetwork() || 'testnet4';
    
    // BitcoinJS 번들에서 네트워크 객체 가져오기
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
      // BitcoinJS가 로드되었는지 확인
      if (!window.BitcoinJS) {
        throw new Error("Bitcoin library not loaded");
      }

      const { bip39, hdWalletFromMnemonic, generateAddress, networks } = window.BitcoinJS;

      // 1. 니모닉 생성
      const mnemonic = bip39.generateMnemonic();

      // 2. 양쪽 네트워크 주소 동시 생성
      const mainnetHdWallet = hdWalletFromMnemonic(mnemonic, networks.bitcoin);
      const testnetHdWallet = hdWalletFromMnemonic(mnemonic, networks.testnet);

      const mainnetAddress = generateAddress(mainnetHdWallet, 0, networks.bitcoin);
      const testnetAddress = generateAddress(testnetHdWallet, 0, networks.testnet);

      // 3. 현재 활성 네트워크 확인
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
      if (!window.BitcoinJS) {
        throw new Error("Bitcoin library not loaded");
      }

      const { hdWalletFromMnemonic, generateAddress, networks } = window.BitcoinJS;

      // 양쪽 네트워크 주소 동시 생성
      const mainnetHdWallet = hdWalletFromMnemonic(mnemonic, networks.bitcoin);
      const testnetHdWallet = hdWalletFromMnemonic(mnemonic, networks.testnet);

      const mainnetAddress = generateAddress(mainnetHdWallet, 0, networks.bitcoin);
      const testnetAddress = generateAddress(testnetHdWallet, 0, networks.testnet);

      // 현재 활성 네트워크 확인
      const currentNetwork = window.BitcoinConfig?.getActiveNetwork() || 'testnet4';

      // 보안: 민감한 정보는 콘솔에 출력하지 않음
      console.log("Wallet imported from mnemonic for both networks");

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
   * 개인키로 지갑 복구
   */
  async importFromPrivateKey(privateKey) {
    try {
      if (!window.BitcoinJS) {
        throw new Error("Bitcoin library not loaded");
      }

      const { ECPair, payments, networks } = window.BitcoinJS;

      // ECPair 생성
      const network = this.getNetworkObject();
      const keyPair = ECPair.fromWIF(privateKey, network);

      // P2WPKH 주소 생성 (Native SegWit)
      const { address } = payments.p2wpkh({
        pubkey: keyPair.publicKey,
        network: network,
      });

      // 보안: 민감한 정보는 콘솔에 출력하지 않음  
      console.log("Wallet imported from private key");

      return {
        address: address,
        privateKey: privateKey,
      };
    } catch (error) {
      console.error("Failed to import from private key:", error);
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
   * 잔액 조회 (Mempool.space API 사용)
   */
  async getBalance(address) {
    try {
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

      // 1. 키페어 생성
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

      // 3. 금액 변환 (BTC -> satoshi)
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

      // 11. 브로드캐스트
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
   * 트랜잭션 상태 조회
   */
  async getTransactionStatus(txHash) {
    try {
      const url = window.BitcoinConfig?.getApiUrl(`/tx/${txHash}/status`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch transaction status: ${response.status}`);
      }

      const status = await response.json();

      return {
        status: status.confirmed ? 'confirmed' : 'pending',
        confirmations: status.block_height ? 
          (await this.getBlockHeight()) - status.block_height + 1 : 0,
      };
    } catch (error) {
      console.error('Failed to get transaction status:', error);
      throw error;
    }
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

  /**
   * 트랜잭션 수수료 예상
   */
  async estimateFee(txParams) {
    try {
      const { amount } = txParams;
      const feeRates = await this.getGasPrice();
      
      // 예상 트랜잭션 크기 (2 inputs, 2 outputs 가정)
      const estimatedSize = 250; // vBytes
      
      return {
        low: (parseInt(feeRates.low) * estimatedSize).toString(),
        medium: (parseInt(feeRates.medium) * estimatedSize).toString(),
        high: (parseInt(feeRates.high) * estimatedSize).toString(),
      };
    } catch (error) {
      console.error('Failed to estimate fee:', error);
      throw error;
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

// BitcoinAdapter 인스턴스 생성 및 설정
const bitcoinAdapter = new BitcoinAdapter(BitcoinAdapterConfig);
window.setAdapter(bitcoinAdapter);

console.log('[BitcoinAdapter] Module loaded');
console.log('[BitcoinAdapter] Network:', window.BitcoinConfig?.getActiveNetwork());