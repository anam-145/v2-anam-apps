// ================================================================
// Bitcoin 유틸리티 헬퍼 함수
// 공통으로 사용되는 유틸리티 함수들
// ================================================================

(function() {
  'use strict';

  // ================================================================
  // 포맷팅 함수
  // ================================================================

  // Satoshi를 BTC로 변환
  function satoshiToBTC(satoshi) {
    return (parseInt(satoshi) / 100000000).toFixed(8);
  }

  // BTC를 Satoshi로 변환
  function btcToSatoshi(btc) {
    return Math.floor(parseFloat(btc) * 100000000);
  }

  // 잔액을 사람이 읽기 쉬운 형식으로 변환 (개선된 버전)
  function formatBalance(satoshi, decimals = 8) {
    // 기본값 및 설정
    const DUST_LIMIT = 546; // Bitcoin dust limit in satoshi
    const MIN_DISPLAY_BTC = 0.00000001; // 1 satoshi in BTC
    
    // satoshi를 BTC로 변환
    const btc = parseFloat(satoshiToBTC(satoshi));
    const absBtc = Math.abs(btc);
    
    // 0인 경우
    if (absBtc === 0) {
      return '0.00000000';
    }
    
    // Dust limit 미만 (546 satoshi = 0.00000546 BTC)
    if (Math.abs(satoshi) < DUST_LIMIT && Math.abs(satoshi) > 0) {
      return `< 0.00000546`; // dust limit 표시
    }
    
    // 매우 작은 금액 (0.0001 BTC 미만)
    if (absBtc < 0.0001) {
      // 최소 2개의 유효 숫자 표시
      const significantDigits = 2;
      const magnitude = Math.floor(Math.log10(absBtc));
      const requiredDecimals = Math.max(8, Math.abs(magnitude) + significantDigits);
      
      // 8자리까지만 표시 (Bitcoin 표준)
      if (requiredDecimals <= 8) {
        return btc.toFixed(8);
      } else {
        // 너무 작으면 근사치 표시
        return `≈ ${btc.toFixed(8)}`;
      }
    }
    
    // 일반 금액 - 동적 정밀도
    // 1 BTC 이상: 4자리
    // 0.1-1 BTC: 5자리
    // 0.01-0.1 BTC: 6자리
    // 0.0001-0.01 BTC: 8자리
    let displayDecimals;
    if (absBtc >= 1) {
      displayDecimals = 4;
    } else if (absBtc >= 0.1) {
      displayDecimals = 5;
    } else if (absBtc >= 0.01) {
      displayDecimals = 6;
    } else {
      displayDecimals = 8;
    }
    
    // decimals 파라미터가 지정되면 우선 사용 (하위 호환성)
    const finalDecimals = (decimals !== 8) ? decimals : displayDecimals;
    
    return btc.toFixed(finalDecimals);
  }

  // 금액을 최소 단위로 변환
  function parseAmount(amount) {
    return btcToSatoshi(amount).toString();
  }

  // 주소 축약 표시
  function shortenAddress(address, chars = 6) {
    if (!address) return "";
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
  }

  // 트랜잭션 ID 축약 표시
  function shortenTxId(txId, chars = 8) {
    if (!txId) return "";
    return `${txId.slice(0, chars)}...${txId.slice(-chars)}`;
  }

  // ================================================================
  // 시간 관련 함수
  // ================================================================

  // 타임스탬프를 상대 시간으로 변환 (예: "5분 전")
  function timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp * 1000) / 1000);
    
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
      }
    }
    
    return 'just now';
  }

  // 타임스탬프를 로컬 시간 문자열로 변환
  function formatTimestamp(timestamp) {
    return new Date(timestamp * 1000).toLocaleString();
  }

  // ================================================================
  // 수수료 관련 함수
  // ================================================================

  // 트랜잭션 크기 추정 (vBytes)
  // inputs * 148 + outputs * 34 + 10 (대략적인 추정)
  function estimateTxSize(inputCount, outputCount) {
    const inputSize = 148;  // P2PKH input
    const outputSize = 34;   // P2PKH output
    const overhead = 10;
    
    return inputCount * inputSize + outputCount * outputSize + overhead;
  }

  // 수수료 계산
  function calculateFee(txSize, feeRate) {
    return txSize * feeRate;
  }

  // 수수료를 BTC로 변환
  function formatFee(feeSatoshi) {
    const btc = satoshiToBTC(feeSatoshi);
    return `${btc} BTC`;
  }

  // ================================================================
  // UTXO 관련 함수
  // ================================================================

  // UTXO 선택 알고리즘 (간단한 버전)
  function selectUTXOs(utxos, targetAmount, feeRate) {
    // 정렬: 큰 금액부터
    const sortedUTXOs = [...utxos].sort((a, b) => b.value - a.value);
    
    const selected = [];
    let totalValue = 0;
    let estimatedFee = 0;
    
    for (const utxo of sortedUTXOs) {
      selected.push(utxo);
      totalValue += utxo.value;
      
      // 예상 수수료 계산
      const txSize = estimateTxSize(selected.length, 2); // 2 outputs (recipient + change)
      estimatedFee = calculateFee(txSize, feeRate);
      
      // 목표 금액 + 수수료를 충족하면 종료
      if (totalValue >= targetAmount + estimatedFee) {
        break;
      }
    }
    
    if (totalValue < targetAmount + estimatedFee) {
      throw new Error('Insufficient funds');
    }
    
    return {
      utxos: selected,
      totalValue,
      fee: estimatedFee,
      change: totalValue - targetAmount - estimatedFee
    };
  }

  // ================================================================
  // 트랜잭션 분석 함수
  // ================================================================

  // 트랜잭션이 보낸 것인지 판별 (Bitcoin 트랜잭션 구조에 맞게)
  function isTransactionSent(tx, currentAddress) {
    // Bitcoin 트랜잭션은 여러 입력과 출력을 가질 수 있음
    // 입력(vin)에 현재 주소가 있으면 보낸 것
    if (tx.vin && Array.isArray(tx.vin)) {
      for (const input of tx.vin) {
        if (input.prevout && input.prevout.scriptpubkey_address === currentAddress) {
          return true;
        }
      }
    }
    return false;
  }

  // 트랜잭션 금액 계산 (satoshi 단위)
  function calculateTransactionAmount(tx, currentAddress) {
    let amount = 0;
    
    // 받은 경우: vout에서 현재 주소로 온 금액 합계
    if (tx.vout && Array.isArray(tx.vout)) {
      for (const output of tx.vout) {
        if (output.scriptpubkey_address === currentAddress) {
          amount += output.value;
        }
      }
    }
    
    // 보낸 경우: vin에서 빠져나간 금액에서 자신에게 돌아온 금액(change) 제외
    if (isTransactionSent(tx, currentAddress)) {
      let totalInput = 0;
      let changeOutput = 0;
      
      // 입력 금액 계산
      if (tx.vin && Array.isArray(tx.vin)) {
        for (const input of tx.vin) {
          if (input.prevout && input.prevout.scriptpubkey_address === currentAddress) {
            totalInput += input.prevout.value;
          }
        }
      }
      
      // 자신에게 돌아온 금액 (change) 계산
      if (tx.vout && Array.isArray(tx.vout)) {
        for (const output of tx.vout) {
          if (output.scriptpubkey_address === currentAddress) {
            changeOutput += output.value;
          }
        }
      }
      
      // 실제 보낸 금액 = 입력 - 거스름돈
      amount = totalInput - changeOutput;
    }
    
    return amount;
  }

  // ================================================================
  // UI 관련 함수
  // ================================================================

  // Toast 메시지 표시
  function showToast(message, type = "info") {
    // 기존 토스트 제거
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("show");
    }, 100);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, BitcoinConfig?.UI?.TOAST_DURATION || 3000);
  }

  // 로딩 표시
  function showLoading(elementId, show = true) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    if (show) {
      element.classList.add('loading');
      element.disabled = true;
    } else {
      element.classList.remove('loading');
      element.disabled = false;
    }
  }

  // 클립보드 복사
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!', 'success');
      return true;
    } catch (error) {
      console.error('Failed to copy:', error);
      showToast('Failed to copy to clipboard', 'error');
      return false;
    }
  }

  // QR 코드 생성 (qrcode.js 라이브러리 필요)
  function generateQRCode(elementId, data, options = {}) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // QRCode 라이브러리가 로드되어 있는지 확인
    if (typeof QRCode === 'undefined') {
      console.error('QRCode library not loaded');
      return;
    }
    
    const defaultOptions = {
      width: 200,
      height: 200,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    };
    
    const qrOptions = { ...defaultOptions, ...options };
    
    // 기존 QR 코드 제거
    element.innerHTML = '';
    
    // 새 QR 코드 생성
    new QRCode(element, {
      text: data,
      ...qrOptions
    });
  }

  // ================================================================
  // 검증 함수
  // ================================================================

  // 금액 검증
  function validateAmount(amount, balance) {
    const amountSatoshi = btcToSatoshi(amount);
    const balanceSatoshi = parseInt(balance);
    
    if (isNaN(amountSatoshi) || amountSatoshi <= 0) {
      return { valid: false, error: 'Invalid amount' };
    }
    
    if (amountSatoshi < BitcoinConfig?.TRANSACTION?.MIN_AMOUNT || 546) {
      return { valid: false, error: 'Amount below dust limit' };
    }
    
    if (amountSatoshi > balanceSatoshi) {
      return { valid: false, error: 'Insufficient balance' };
    }
    
    return { valid: true };
  }

  // 주소 검증 (config.js의 함수 사용)
  function validateAddress(address) {
    if (!address) {
      return { valid: false, error: 'Address required' };
    }
    
    const isValid = BitcoinConfig?.isValidAddress(address) || false;
    
    if (!isValid) {
      return { valid: false, error: 'Invalid Bitcoin address' };
    }
    
    return { valid: true };
  }

  // ================================================================
  // 네트워크 요청 헬퍼
  // ================================================================

  // API 요청 래퍼
  async function fetchAPI(endpoint, options = {}) {
    try {
      const url = BitcoinConfig?.getApiUrl(endpoint) || 
                  `https://mempool.space/testnet4/api${endpoint}`;
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  // 트랜잭션 브로드캐스트
  async function broadcastTransaction(txHex) {
    return fetchAPI('/tx', {
      method: 'POST',
      body: txHex,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }

  // ================================================================
  // 캐시 관리
  // ================================================================

  // 캐시 저장
  function setCache(key, data, ttl) {
    const expiry = Date.now() + (ttl || 60000);
    localStorage.setItem(key, JSON.stringify({
      data,
      expiry
    }));
  }

  // 캐시 가져오기
  function getCache(key) {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      
      const { data, expiry } = JSON.parse(cached);
      
      if (Date.now() > expiry) {
        localStorage.removeItem(key);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  // ================================================================
  // 전역 헬퍼 객체
  // ================================================================

  const BitcoinUtils = {
    // 포맷팅
    satoshiToBTC,
    btcToSatoshi,
    formatBalance,
    parseAmount,
    shortenAddress,
    shortenTxId,
    
    // 시간
    timeAgo,
    getTimeAgo: timeAgo,  // 별칭 (하위 호환성)
    formatTimestamp,
    
    // 수수료
    estimateTxSize,
    calculateFee,
    formatFee,
    
    // UTXO
    selectUTXOs,
    
    // 트랜잭션 분석
    isTransactionSent,
    calculateTransactionAmount,
    
    // UI
    showToast,
    showLoading,
    copyToClipboard,
    generateQRCode,
    
    // 검증
    validateAmount,
    validateAddress,
    
    // 네트워크
    fetchAPI,
    broadcastTransaction,
    
    // 캐시
    setCache,
    getCache
  };

  // ================================================================
  // 모듈 내보내기
  // ================================================================

  window.BitcoinUtils = BitcoinUtils;

  console.log('[BitcoinUtils] Module loaded');
})();