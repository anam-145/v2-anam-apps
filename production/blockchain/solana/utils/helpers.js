// ================================================================
// Solana 유틸리티 헬퍼 함수
// ================================================================

(function() {
  'use strict';

  // ================================================================
  // 단위 변환 함수
  // ================================================================

  // Lamports를 SOL로 변환
  function lamportsToSol(lamports) {
    return parseFloat(lamports) / 1000000000;
  }

  // SOL을 Lamports로 변환
  function solToLamports(sol) {
    return Math.floor(parseFloat(sol) * 1000000000);
  }

  // 잔액 포맷팅 (SOL)
  function formatBalance(lamports, options = {}) {
    const sol = lamportsToSol(lamports);
    const absSol = Math.abs(sol);
    
    // 0 SOL
    if (absSol === 0) {
      return '0.000000000';
    }
    
    // 매우 작은 금액 (0.0001 SOL 미만)
    if (absSol < 0.0001) {
      return sol.toFixed(9);
    }
    
    // 일반 금액 포맷팅
    let decimals;
    if (absSol >= 1) {
      decimals = 4;
    } else if (absSol >= 0.1) {
      decimals = 5;
    } else if (absSol >= 0.01) {
      decimals = 6;
    } else {
      decimals = 9;
    }
    
    return sol.toFixed(decimals);
  }

  // 금액을 문자열로 변환
  function convertAmount(amount) {
    return solToLamports(amount).toString();
  }

  // ================================================================
  // 주소 관련 함수
  // ================================================================

  // 주소 축약
  function shortenAddress(address, chars = 4) {
    if (!address) return '';
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
  }

  // 주소 유효성 검증
  function isValidAddress(address) {
    if (!address || typeof address !== 'string') {
      return false;
    }
    // Solana 주소는 base58 형식 (32-44 문자)
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  // ================================================================
  // 수수료 관련 함수
  // ================================================================

  // Solana는 고정 수수료 사용
  function calculateFee() {
    return 5000; // 5000 lamports
  }

  // 수수료 포맷팅
  function formatFee(feeLamports) {
    const sol = lamportsToSol(feeLamports);
    return `${sol} SOL`;
  }

  // ================================================================
  // 트랜잭션 관련 함수
  // ================================================================

  // 트랜잭션 타입 판별
  function getTransactionType(tx, currentAddress) {
    // Solana 트랜잭션 구조에 맞게 수정
    if (!tx || !currentAddress) return 'unknown';
    
    // 간단한 판별 로직
    if (tx.from === currentAddress) {
      return 'sent';
    } else if (tx.to === currentAddress) {
      return 'received';
    }
    
    return 'unknown';
  }

  // 트랜잭션 포맷팅
  function formatTransaction(tx, currentAddress) {
    const type = getTransactionType(tx, currentAddress);
    
    return {
      hash: tx.signature || tx.hash,
      type: type,
      from: tx.from,
      to: tx.to,
      amount: formatBalance(tx.amount || 0),
      fee: formatFee(tx.fee || 5000),
      timestamp: tx.timestamp || Date.now(),
      status: tx.status || 'confirmed'
    };
  }
  
  // 트랜잭션 전송 여부 판별
  function isTransactionSent(tx, currentAddress) {
    // Solana에서는 복잡한 판별 로직이 필요할 수 있음
    // from 필드가 있으면 사용
    if (tx.from) {
      return tx.from === currentAddress;
    }

    // preBalance > postBalance이면 전송
    if (tx.preBalance !== undefined && tx.postBalance !== undefined) {
      return tx.preBalance > tx.postBalance;
    }

    // 기본값: 받은 것으로 처리
    return false;
  }
  
  // 트랜잭션 금액 계산
  function calculateTransactionAmount(tx, currentAddress) {
    // Solana 트랜잭션에서 금액 계산
    // preBalance와 postBalance가 있으면 그 차이를 계산
    if (tx.preBalance !== undefined && tx.postBalance !== undefined) {
      const diff = Math.abs(tx.postBalance - tx.preBalance);
      return diff;
    }

    // amount 필드가 있으면 사용
    if (tx.amount !== undefined) {
      return tx.amount;
    }

    return 0;
  }
  
  // 시간 계산 (timeago)
  function getTimeAgo(timestamp) {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  // ================================================================
  // UI 헬퍼 함수
  // ================================================================

  // 토스트 메시지 표시
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 애니메이션
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    // 3초 후 제거
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, window.SolanaConfig?.UI?.TOAST_DURATION || 3000);
  }

  // 로딩 상태 표시
  function showLoading(element, loading = true) {
    if (!element) return;
    
    if (loading) {
      element.classList.add('loading');
      element.disabled = true;
    } else {
      element.classList.remove('loading');
      element.disabled = false;
    }
  }

  // ================================================================
  // 유효성 검증 함수
  // ================================================================

  // 금액 유효성 검증
  function validateAmount(amount) {
    const amountNum = parseFloat(amount);
    
    if (isNaN(amountNum) || amountNum <= 0) {
      return { valid: false, error: 'Invalid amount' };
    }
    
    const amountLamports = solToLamports(amount);
    
    // 최소 금액 체크 (1 lamport)
    if (amountLamports < 1) {
      return { valid: false, error: 'Amount too small' };
    }
    
    return { valid: true };
  }

  // 주소 유효성 검증
  function validateAddress(address) {
    if (!address) {
      return { valid: false, error: 'Address is required' };
    }
    
    const isValid = isValidAddress(address);
    
    if (!isValid) {
      return { valid: false, error: 'Invalid Solana address' };
    }
    
    return { valid: true };
  }

  // ================================================================
  // 네트워크 관련 함수
  // ================================================================

  // RPC 엔드포인트 가져오기
  function getRpcEndpoint() {
    const network = window.SolanaConfig?.getCurrentNetwork();
    return network?.rpcUrl || 'https://api.testnet.solana.com';
  }

  // 현재 네트워크 가져오기
  function getCurrentNetwork() {
    return window.SolanaConfig?.getActiveNetwork() || 'testnet';
  }

  // Explorer URL 생성
  function getExplorerUrl(txHash) {
    const network = getCurrentNetwork();
    const baseUrl = 'https://explorer.solana.com';
    
    if (network === 'mainnet') {
      return `${baseUrl}/tx/${txHash}`;
    } else {
      return `${baseUrl}/tx/${txHash}?cluster=${network}`;
    }
  }

  // ================================================================
  // 캐시 관련 함수
  // ================================================================

  // 캐시 키 생성
  function getCacheKey(type, address) {
    const network = getCurrentNetwork();
    return `sol_${network}_${type}_${address}`;
  }

  // 캐시 저장
  function setCache(key, data, ttl = 60000) {
    const cacheData = {
      data: data,
      timestamp: Date.now(),
      ttl: ttl
    };
    
    try {
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (e) {
      console.error('Cache save failed:', e);
    }
  }

  // 캐시 읽기
  function getCache(key) {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      const now = Date.now();

      // TTL 체크
      if (now - cacheData.timestamp > cacheData.ttl) {
        localStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (e) {
      console.error('Cache read failed:', e);
      return null;
    }
  }

  // ================================================================
  // QR 코드 관련
  // ================================================================

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
  // 전역 객체로 내보내기
  // ================================================================

  const SolanaUtils = {
    // 단위 변환
    lamportsToSol,
    solToLamports,
    formatBalance,
    convertAmount,
    
    // 주소 관련
    shortenAddress,
    isValidAddress,
    
    // 수수료 관련
    calculateFee,
    formatFee,
    
    // 트랜잭션 관련
    getTransactionType,
    formatTransaction,
    isTransactionSent,
    calculateTransactionAmount,
    getTimeAgo,
    
    // UI 헬퍼
    showToast,
    showLoading,
    
    // 유효성 검증
    validateAmount,
    validateAddress,
    
    // 네트워크 관련
    getRpcEndpoint,
    getCurrentNetwork,
    getExplorerUrl,
    
    // 캐시 관련
    getCacheKey,
    setCache,
    getCache,

    // QR 코드
    generateQRCode
  };

  // 전역 노출
  if (typeof window !== 'undefined') {
    window.SolanaUtils = SolanaUtils;
    console.log('[SolanaUtils] Loaded');
  }

})();