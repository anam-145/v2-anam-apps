// ================================================================
// Ethereum 유틸리티 함수들
// 공통으로 사용되는 헬퍼 함수 모음
// ================================================================

(function() {
  'use strict';

  // ================================================================
  // 포맷팅 유틸리티
  // ================================================================

  // 잔액을 사람이 읽기 쉬운 형식으로 변환
  function formatBalance(balance, decimals = 18) {
    try {
      // ethers v5 사용
      if (typeof ethers !== 'undefined' && ethers.utils && ethers.utils.formatUnits) {
        return ethers.utils.formatUnits(balance, decimals);
      }
      // ethers v6 (미래 호환성)
      if (typeof ethers !== 'undefined' && ethers.formatEther && decimals === 18) {
        return ethers.formatEther(balance);
      }
    } catch (error) {
      console.log("Error formatting balance:", error);
    }
    
    // Fallback: BigInt 사용 (정밀도 손실 최소화)
    try {
      const divisor = BigInt(10) ** BigInt(decimals);
      const balanceBigInt = BigInt(balance);
      const wholePart = balanceBigInt / divisor;
      const fractionalPart = balanceBigInt % divisor;
      
      // 소수점 4자리까지만 표시
      const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
      const displayFraction = fractionalStr.substring(0, 4);
      
      return `${wholePart}.${displayFraction}`;
    } catch (fallbackError) {
      console.log("Fallback formatting error:", fallbackError);
      return "0.0000";
    }
  }

  // 금액을 최소 단위로 변환 (ETH -> Wei)
  function parseAmount(amount, decimals = 18) {
    try {
      // ethers 사용 가능한 경우
      if (typeof ethers !== 'undefined' && ethers.utils) {
        if (decimals === 18) {
          return ethers.utils.parseEther(amount).toString();
        } else {
          return ethers.utils.parseUnits(amount, decimals).toString();
        }
      }
    } catch (error) {
      console.log("Error parsing amount with ethers:", error);
    }
    
    // Fallback
    const value = parseFloat(amount) * Math.pow(10, decimals);
    return value.toString();
  }

  // 주소 축약 표시
  function shortenAddress(address, chars = 4) {
    if (!address) return "";
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
  }

  // 16진수 변환
  function toHex(num) {
    if (typeof num === 'string' && num.startsWith('0x')) {
      return num;
    }
    return '0x' + BigInt(num).toString(16);
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

  // Ethereum 주소 검증
  function isValidAddress(address) {
    if (typeof ethers !== 'undefined' && ethers.utils) {
      return ethers.utils.isAddress(address);
    }
    // Fallback: 기본 정규식 검증
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  // 트랜잭션 해시 검증
  function isValidTxHash(hash) {
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
  }

  // Private Key 검증
  function isValidPrivateKey(key) {
    return /^0x[a-fA-F0-9]{64}$/.test(key);
  }

  // Mnemonic 검증
  function isValidMnemonic(mnemonic) {
    const words = mnemonic.trim().split(/\s+/);
    return words.length === 12 || words.length === 24;
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
      return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  // 시간 차이 계산 (밀리초 타임스탬프용)
  function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return `${seconds} seconds ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;

    const months = Math.floor(days / 30);
    return `${months} month${months > 1 ? "s" : ""} ago`;
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
  // 트랜잭션 유틸리티
  // ================================================================

  // 트랜잭션 타입 판별 (보낸/받은)
  function isTransactionSent(tx, currentAddress) {
    return tx.from && tx.from.toLowerCase() === currentAddress.toLowerCase();
  }

  // Wei를 ETH로 변환하여 표시
  function formatTransactionValue(value, decimals = 18) {
    if (!value || value === "0") return "0";
    return formatBalance(value, decimals);
  }

  // 트랜잭션 상태 텍스트
  function getTransactionStatusText(txReceipt_status) {
    if (txReceipt_status === "1") return "Success";
    if (txReceipt_status === "0") return "Failed";
    return "Pending";
  }

  // ================================================================
  // 네트워크 유틸리티
  // ================================================================

  // Etherscan URL 생성
  function getEtherscanUrl(type, value, network = 'sepolia') {
    const baseUrls = {
      'mainnet': 'https://etherscan.io',
      'sepolia': 'https://sepolia.etherscan.io',
      'goerli': 'https://goerli.etherscan.io'
    };
    
    const baseUrl = baseUrls[network] || baseUrls['sepolia'];
    
    switch(type) {
      case 'tx':
        return `${baseUrl}/tx/${value}`;
      case 'address':
        return `${baseUrl}/address/${value}`;
      case 'block':
        return `${baseUrl}/block/${value}`;
      default:
        return baseUrl;
    }
  }

  // 가스 가격 포맷팅
  function formatGasPrice(gasPrice) {
    if (typeof ethers !== 'undefined' && ethers.utils) {
      return ethers.utils.formatUnits(gasPrice, 'gwei') + ' Gwei';
    }
    // Fallback
    return (parseInt(gasPrice) / 1e9).toFixed(2) + ' Gwei';
  }

  // ================================================================
  // 모듈 내보내기
  // ================================================================

  window.EthereumUtils = {
    // 포맷팅
    formatBalance,
    parseAmount,
    shortenAddress,
    toHex,
    
    // UI
    showToast,
    copyToClipboard,
    
    // 검증
    isValidAddress,
    isValidTxHash,
    isValidPrivateKey,
    isValidMnemonic,
    
    // 시간
    formatTimestamp,
    getTimeAgo,
    
    // 저장소
    setCache,
    getCache,
    clearCache,
    
    // 트랜잭션
    isTransactionSent,
    formatTransactionValue,
    getTransactionStatusText,
    
    // 네트워크
    getEtherscanUrl,
    formatGasPrice
  };

  console.log('[EthereumUtils] Module loaded');
})();