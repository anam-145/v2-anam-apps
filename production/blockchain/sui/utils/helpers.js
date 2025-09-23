// ================================================================
// Sui 유틸리티 헬퍼 함수
// 공통으로 사용되는 유틸리티 함수들
// ================================================================

(function() {
  'use strict';

  // ================================================================
  // 포맷팅 함수
  // ================================================================

  // MIST를 SUI로 변환 (1 SUI = 10^9 MIST)
  function mistToSui(mist) {
    return (BigInt(mist) / BigInt(1000000000)).toString() + '.' + 
           (BigInt(mist) % BigInt(1000000000)).toString().padStart(9, '0').replace(/0+$/, '').replace(/^$/, '0');
  }

  // SUI를 MIST로 변환
  function suiToMist(sui) {
    const [whole = '0', decimal = '0'] = sui.toString().split('.');
    const paddedDecimal = decimal.padEnd(9, '0').slice(0, 9);
    return (BigInt(whole) * BigInt(1000000000) + BigInt(paddedDecimal)).toString();
  }

  // 잔액을 사람이 읽기 쉬운 형식으로 변환
  function formatBalance(mist, decimals = 9) {
    // 기본값 및 설정
    const MIN_DISPLAY_SUI = 0.000000001; // 1 MIST in SUI
    
    // MIST를 SUI로 변환
    const suiStr = mistToSui(mist);
    const sui = parseFloat(suiStr);
    const absSui = Math.abs(sui);
    
    // 0인 경우
    if (absSui === 0) {
      return '0.000000000';
    }
    
    // 매우 작은 금액 (0.001 SUI 미만)
    if (absSui < 0.001) {
      // 최소 2개의 유효 숫자 표시
      const significantDigits = 2;
      const magnitude = Math.floor(Math.log10(absSui));
      const requiredDecimals = Math.max(9, Math.abs(magnitude) + significantDigits);
      
      // 9자리까지만 표시 (Sui 표준)
      if (requiredDecimals <= 9) {
        return sui.toFixed(9).replace(/0+$/, '').replace(/\.$/, '.0');
      } else {
        // 너무 작으면 근사치 표시
        return `≈ ${sui.toFixed(9)}`;
      }
    }
    
    // 일반 금액 - 동적 정밀도
    // 1 SUI 이상: 4자리
    // 0.1-1 SUI: 5자리
    // 0.01-0.1 SUI: 6자리
    // 0.001-0.01 SUI: 9자리
    let displayDecimals;
    if (absSui >= 1) {
      displayDecimals = 4;
    } else if (absSui >= 0.1) {
      displayDecimals = 5;
    } else if (absSui >= 0.01) {
      displayDecimals = 6;
    } else {
      displayDecimals = 9;
    }
    
    // decimals 파라미터가 지정되면 우선 사용 (하위 호환성)
    const finalDecimals = (decimals !== 9) ? decimals : displayDecimals;
    
    return sui.toFixed(finalDecimals).replace(/0+$/, '').replace(/\.$/, '.0');
  }

  // 금액을 최소 단위로 변환
  function parseAmount(amount) {
    return suiToMist(amount);
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

  // Sui 가스 예산 추정
  function estimateGasBudget(feeRate = 'medium') {
    const rates = SuiConfig?.TRANSACTION?.FEE_RATES || {
      slow: 100000,
      medium: 200000,
      fast: 500000,
      urgent: 1000000
    };
    
    return rates[feeRate] || rates.medium;
  }

  // 수수료를 SUI로 변환
  function formatFee(feeMist) {
    const sui = mistToSui(feeMist);
    return `${sui} SUI`;
  }

  // ================================================================
  // Sui 코인 객체 관련 함수
  // ================================================================

  // 코인 객체 선택 (Sui는 UTXO 대신 객체 모델 사용)
  function selectCoinObjects(coins, targetAmount, gasBudget) {
    // 정렬: 큰 금액부터
    const sortedCoins = [...coins].sort((a, b) => 
      BigInt(b.balance) - BigInt(a.balance)
    );
    
    const selected = [];
    let totalBalance = 0n;
    
    for (const coin of sortedCoins) {
      selected.push(coin);
      totalBalance += BigInt(coin.balance);
      
      // 목표 금액 + 가스 예산을 충족하면 종료
      if (totalBalance >= BigInt(targetAmount) + BigInt(gasBudget)) {
        break;
      }
    }
    
    if (totalBalance < BigInt(targetAmount) + BigInt(gasBudget)) {
      throw new Error('Insufficient funds');
    }
    
    return {
      coins: selected,
      totalBalance: totalBalance.toString(),
      change: (totalBalance - BigInt(targetAmount) - BigInt(gasBudget)).toString()
    };
  }

  // ================================================================
  // 트랜잭션 분석 함수
  // ================================================================

  // 트랜잭션이 보낸 것인지 판별 (Sui 트랜잭션 구조)
  function isTransactionSent(tx, currentAddress) {
    // Sui 트랜잭션: sender가 현재 주소면 보낸 것
    if (tx.transaction && tx.transaction.data) {
      return tx.transaction.data.sender === currentAddress;
    }
    // 간단한 tx 객체인 경우
    if (tx.sender) {
      return tx.sender === currentAddress;
    }
    return false;
  }

  // 트랜잭션 금액 계산 (MIST 단위)
  function calculateTransactionAmount(tx, currentAddress) {
    let amount = '0';
    
    // Sui 트랜잭션 효과에서 금액 계산
    if (tx.effects) {
      const balanceChanges = tx.effects.balanceChanges || [];
      for (const change of balanceChanges) {
        if (change.owner && change.owner.AddressOwner === currentAddress) {
          // 음수면 보낸 것, 양수면 받은 것
          amount = change.amount;
          break;
        }
      }
    }
    
    // 간단한 금액 정보가 있는 경우
    if (tx.amount) {
      amount = tx.amount;
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
    }, SuiConfig?.UI?.TOAST_DURATION || 3000);
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
    const amountMist = suiToMist(amount);
    const balanceMist = BigInt(balance);
    
    if (!amountMist || BigInt(amountMist) <= 0n) {
      return { valid: false, error: 'Invalid amount' };
    }
    
    // Sui는 최소 금액 제한 없음 (1 MIST도 전송 가능)
    // Bitcoin과 달리 dust limit이 없음
    
    if (BigInt(amountMist) > balanceMist) {
      return { valid: false, error: 'Insufficient balance' };
    }
    
    return { valid: true };
  }

  // 주소 검증 (config.js의 함수 사용)
  function validateAddress(address) {
    if (!address) {
      return { valid: false, error: 'Address required' };
    }
    
    const isValid = SuiConfig?.isValidAddress(address) || false;
    
    if (!isValid) {
      return { valid: false, error: 'Invalid Sui address' };
    }
    
    return { valid: true };
  }

  // ================================================================
  // 네트워크 요청 헬퍼
  // ================================================================

  // API 요청 래퍼
  async function fetchAPI(endpoint, options = {}) {
    try {
      const url = SuiConfig?.getApiUrl(endpoint) || 
                  `https://fullnode.testnet.sui.io:443${endpoint}`;
      
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

  // 트랜잭션 브로드캐스트 (Sui RPC)
  async function broadcastTransaction(txBytes, signatures) {
    return fetchAPI('', {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sui_executeTransactionBlock',
        params: [
          txBytes,
          signatures,
          {
            showInput: false,
            showRawInput: false,
            showEffects: true,
            showEvents: false,
            showObjectChanges: false,
            showBalanceChanges: false
          },
          'WaitForLocalExecution'
        ]
      })
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

  const SuiUtils = {
    // 포맷팅
    mistToSui,
    suiToMist,
    SUItoMist: suiToMist,  // 별칭 (대소문자 호환성)
    formatBalance,
    parseAmount,
    shortenAddress,
    shortenTxId,
    
    // 시간
    timeAgo,
    getTimeAgo: timeAgo,  // 별칭 (하위 호환성)
    formatTimestamp,
    
    // 수수료
    estimateGasBudget,
    formatFee,
    
    // 코인 객체
    selectCoinObjects,
    
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

  window.SuiUtils = SuiUtils;

  console.log('[SuiUtils] Module loaded');
})();