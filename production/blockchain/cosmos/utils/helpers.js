// ================================================================
// Cosmos 유틸리티 헬퍼 함수
// 공통으로 사용되는 유틸리티 함수들
// ================================================================

(function() {
  'use strict';

  // ================================================================
  // 포맷팅 함수
  // ================================================================

  // uatom을 ATOM으로 변환
  function uatomToAtom(uatom) {
    return (parseInt(uatom) / 1000000).toFixed(6);
  }

  // ATOM을 uatom으로 변환
  function atomToUatom(atom) {
    return Math.floor(parseFloat(atom) * 1000000);
  }

  // 잔액을 사람이 읽기 쉬운 형식으로 변환
  function formatBalance(uatom, decimals = 6) {
    // 기본값 및 설정
    const MIN_DISPLAY_ATOM = 0.000001; // 1 uatom in ATOM

    // uatom을 ATOM으로 변환
    const atom = parseFloat(uatomToAtom(uatom));
    const absAtom = Math.abs(atom);

    // 0인 경우
    if (absAtom === 0) {
      return '0.000000';
    }

    // 매우 작은 금액 (0.0001 ATOM 미만)
    if (absAtom < 0.0001) {
      // 최소 2개의 유효 숫자 표시
      const significantDigits = 2;
      const magnitude = Math.floor(Math.log10(absAtom));
      const requiredDecimals = Math.max(6, Math.abs(magnitude) + significantDigits);

      // 6자리까지만 표시 (Cosmos 표준)
      if (requiredDecimals <= 8) {
        return atom.toFixed(8);
      } else {
        // 너무 작으면 근사치 표시
        return `≈ ${atom.toFixed(8)}`;
      }
    }
    
    // 일반 금액 - 동적 정밀도
    // 1 ATOM 이상: 4자리
    // 0.1-1 ATOM: 5자리
    // 0.01-0.1 ATOM: 6자리
    // 0.0001-0.01 ATOM: 8자리
    let displayDecimals;
    if (absAtom >= 1) {
      displayDecimals = 4;
    } else if (absAtom >= 0.1) {
      displayDecimals = 5;
    } else if (absAtom >= 0.01) {
      displayDecimals = 6;
    } else {
      displayDecimals = 8;
    }
    
    // decimals 파라미터가 지정되면 우선 사용 (하위 호환성)
    const finalDecimals = (decimals !== 6) ? decimals : displayDecimals;

    return atom.toFixed(finalDecimals);
  }

  // 금액을 최소 단위로 변환
  function parseAmount(amount) {
    return atomToUatom(amount).toString();
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
    const now = Date.now();
    const timestampMs = timestamp * 1000;
    const seconds = Math.floor((now - timestampMs) / 1000);

    // 미래 시간 처리 (Cosmos 테스트넷)
    if (seconds < 0) {
      const date = new Date(timestampMs);
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();
      const hour = date.getHours().toString().padStart(2, '0');
      const minute = date.getMinutes().toString().padStart(2, '0');
      return `${month} ${day}, ${hour}:${minute}`;
    }

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

  // 가스 수수료 계산 (Cosmos는 가스 모델 사용)
  function calculateGasFee(gasLimit, gasPrice) {
    // gasLimit: 가스 한도 (기본 200,000)
    // gasPrice: uatom 단위 가스 가격
    return gasLimit * gasPrice;
  }

  // 수수료를 ATOM로 변환
  function formatFee(feeUatom) {
    const atom = uatomToAtom(feeUatom);
    return `${atom} ATOM`;
  }

  // ================================================================
  // Cosmos 트랜잭션 헬퍼
  // ================================================================

  // 트랜잭션 가스 한도 추정
  function estimateGasLimit(msgType) {
    // Cosmos 메시지 타입별 가스 한도
    const gasLimits = {
      'send': 80000,        // 기본 전송
      'delegate': 250000,   // 스테이킹 위임
      'undelegate': 250000, // 스테이킹 해제
      'redelegate': 300000, // 재위임
      'withdraw': 200000    // 리워드 출금
    };

    return gasLimits[msgType] || 200000; // 기본값
  }

  // ================================================================
  // 트랜잭션 분석 함수
  // ================================================================

  // 트랜잭션이 보낸 것인지 판별 (Cosmos 트랜잭션 구조)
  function isTransactionSent(tx, currentAddress) {
    // from과 from_address 둘 다 체크 (호환성)
    if (tx.from_address) {
      return tx.from_address === currentAddress;
    }

    if (tx.from) {
      return tx.from === currentAddress;
    }

    // messages 배열 확인 (Cosmos SDK 형식)
    if (tx.messages && Array.isArray(tx.messages)) {
      for (const msg of tx.messages) {
        if (msg.from_address === currentAddress) {
          return true;
        }
      }
    }

    return false;
  }

  // 트랜잭션 금액 계산 (uatom 단위)
  function calculateTransactionAmount(tx, currentAddress) {
    let amount = 0;

    // Cosmos 트랜잭션 구조
    if (tx.amount) {
      // 단순 전송의 경우
      if (typeof tx.amount === 'string') {
        amount = parseInt(tx.amount);
      } else if (tx.amount.amount) {
        amount = parseInt(tx.amount.amount);
      }
    }

    // messages 배열에서 금액 추출 (Cosmos SDK 형식)
    if (tx.messages && Array.isArray(tx.messages)) {
      for (const msg of tx.messages) {
        if (msg['@type'] === '/cosmos.bank.v1beta1.MsgSend') {
          // 보낸 트랜잭션
          if (msg.from_address === currentAddress) {
            for (const coin of msg.amount) {
              if (coin.denom === 'uatom') {
                amount += parseInt(coin.amount);
              }
            }
          }
          // 받은 트랜잭션
          else if (msg.to_address === currentAddress) {
            for (const coin of msg.amount) {
              if (coin.denom === 'uatom') {
                amount += parseInt(coin.amount);
              }
            }
          }
        }
      }
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
    }, window.CosmosConfig?.UI?.TOAST_DURATION || 3000);
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
    const amountUatom = atomToUatom(amount);
    const balanceUatom = parseInt(balance);
    
    if (isNaN(amountUatom) || amountUatom <= 0) {
      return { valid: false, error: 'Invalid amount' };
    }
    
    // Cosmos는 최소 1 uatom 전송 가능
    if (amountUatom < 1) {
      return { valid: false, error: 'Amount must be at least 1 uatom' };
    }
    
    if (amountUatom > balanceUatom) {
      return { valid: false, error: 'Insufficient balance' };
    }
    
    return { valid: true };
  }

  // 주소 검증 (config.js의 함수 사용)
  function validateAddress(address) {
    if (!address) {
      return { valid: false, error: 'Address required' };
    }
    
    const isValid = window.CosmosConfig?.isValidAddress(address) || false;
    
    if (!isValid) {
      return { valid: false, error: 'Invalid Cosmos address' };
    }
    
    return { valid: true };
  }

  // ================================================================
  // 네트워크 요청 헬퍼
  // ================================================================

  // API 요청 래퍼
  async function fetchAPI(endpoint, options = {}) {
    try {
      const url = window.CosmosConfig?.getRestUrl() || 
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

  const CosmosUtils = {
    // 포맷팅
    uatomToAtom,
    atomToUatom,
    ATOMtoUatom: atomToUatom,  // 별칭 (대소문자 호환성)
    formatBalance,
    parseAmount,
    shortenAddress,
    shortenTxId,
    
    // 시간
    timeAgo,
    getTimeAgo: timeAgo,  // 별칭 (하위 호환성)
    formatTimestamp,

    // 수수료
    calculateGasFee,
    estimateGasLimit,
    formatFee,
    
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

  window.CosmosUtils = CosmosUtils;

  console.log('[CosmosUtils] Module loaded');
})();