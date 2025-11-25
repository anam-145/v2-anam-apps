// ================================================================
// Liberia Stellar 유틸리티 함수들
// 공통으로 사용되는 헬퍼 함수 모음
// ================================================================

(function() {
  'use strict';

  // ================================================================
  // 포맷팅 유틸리티
  // ================================================================

  // 잔액을 사람이 읽기 쉬운 형식으로 변환 (Stellar XLM - 7 decimals)
  function formatBalance(balance, decimals = 7) {
    try {
      const value = parseFloat(balance);

      if (isNaN(value) || value === 0) {
        return '0.00';
      }

      // 매우 작은 금액
      if (value < 0.0000001 && value > 0) {
        return '< 0.0000001';
      }

      // 일반 금액 - 동적 정밀도
      if (value >= 1000) {
        return value.toFixed(2);
      } else if (value >= 1) {
        return value.toFixed(4);
      } else {
        return value.toFixed(7);
      }
    } catch (error) {
      console.log("Error formatting balance:", error);
      return '0.00';
    }
  }

  // stroops를 XLM으로 변환
  function stroopsToXLM(stroops) {
    return (parseInt(stroops) / 10000000).toFixed(7);
  }

  // XLM을 stroops로 변환
  function xlmToStroops(xlm) {
    return Math.round(parseFloat(xlm) * 10000000);
  }

  // 주소 축약 표시
  function shortenAddress(address, chars = 4) {
    if (!address) return "";
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
  }

  // ================================================================
  // UI 유틸리티
  // ================================================================

  // Toast 메시지 표시
  function showToast(message, type = "info") {
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
    }, 3000);
  }

  // 클립보드 복사
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      const result = document.execCommand('copy');
      document.body.removeChild(textArea);
      return result;
    } catch (error) {
      console.log("Copy to clipboard failed:", error);
      return false;
    }
  }

  // ================================================================
  // 검증 유틸리티
  // ================================================================

  // Stellar 주소 검증 (G로 시작하는 56자)
  function isValidAddress(address) {
    if (!address || typeof address !== 'string') return false;
    return /^G[A-Z2-7]{55}$/.test(address);
  }

  // 트랜잭션 해시 검증
  function isValidTxHash(hash) {
    return /^[a-f0-9]{64}$/i.test(hash);
  }

  // Stellar Secret Key 검증 (S로 시작하는 56자)
  function isValidSecretKey(key) {
    if (!key || typeof key !== 'string') return false;
    return /^S[A-Z2-7]{55}$/.test(key);
  }

  // 금액 검증
  function isValidAmount(amount, minAmount = 0.0000001) {
    const value = parseFloat(amount);
    return !isNaN(value) && value >= minAmount;
  }

  // 메모 검증 (최대 28바이트)
  function isValidMemo(memo, maxBytes = 28) {
    if (!memo) return true;
    const bytes = new TextEncoder().encode(memo);
    return bytes.length <= maxBytes;
  }

  // ================================================================
  // 시간 유틸리티
  // ================================================================

  // 타임스탬프를 읽기 쉬운 형식으로 변환
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
      return "Just now";
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  // 시간 차이 계산 (밀리초 타임스탬프용)
  function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return "Just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;

    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }

  // ================================================================
  // 저장소 유틸리티
  // ================================================================

  // 캐시 저장 (TTL 지원)
  function setCache(key, data, ttlMs) {
    const cacheData = {
      data: data,
      timestamp: Date.now(),
      ttl: ttlMs
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
  }

  // 캐시 읽기
  function getCache(key) {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      const now = Date.now();

      // TTL 확인
      if (cacheData.ttl && (now - cacheData.timestamp) > cacheData.ttl) {
        localStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.log("Cache read error:", error);
      return null;
    }
  }

  // 캐시 삭제
  function clearCache(key) {
    localStorage.removeItem(key);
  }

  // ================================================================
  // 네트워크 유틸리티
  // ================================================================

  // 네트워크 상태 확인
  async function checkNetworkStatus() {
    try {
      const horizonUrl = window.LiberiaConfig?.horizonUrl || "https://horizon-testnet.stellar.org";
      // GET 요청으로 루트 엔드포인트 체크 (CORS 호환)
      const response = await fetch(horizonUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      return response.ok;
    } catch (error) {
      console.log('[StellarUtils] Network check failed:', error.message);
      return false;
    }
  }

  // 가격 데이터 가져오기
  async function fetchPriceData() {
    try {
      const url = window.LiberiaConfig?.getPriceApiUrl?.() ||
        "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd";
      const response = await fetch(url);
      const data = await response.json();
      return data?.stellar?.usd || 0;
    } catch (error) {
      console.log("Price fetch failed:", error);
      return 0;
    }
  }

  // ================================================================
  // 모듈 내보내기
  // ================================================================

  const StellarUtils = {
    // 포맷팅
    formatBalance,
    stroopsToXLM,
    xlmToStroops,
    shortenAddress,

    // UI
    showToast,
    copyToClipboard,

    // 검증
    isValidAddress,
    isValidTxHash,
    isValidSecretKey,
    isValidAmount,
    isValidMemo,

    // 시간
    formatTimestamp,
    getTimeAgo,

    // 저장소
    setCache,
    getCache,
    clearCache,

    // 네트워크
    checkNetworkStatus,
    fetchPriceData
  };

  // 여러 이름으로 노출 (호환성)
  window.StellarUtils = StellarUtils;
  window.LiberiaUtils = StellarUtils;
  window.EthereumUtils = StellarUtils;  // 기존 코드 호환용

  // CacheManager 호환용
  window.CacheManager = {
    get: getCache,
    set: setCache,
    clear: clearCache
  };

  console.log('[StellarUtils] Liberia Stellar helpers module loaded');
})();
