// ================================================================
// Stellar2 Helpers - 템플릿 기반 유틸리티 함수
// ================================================================

// 포맷팅 함수들
function formatBalance(balance, decimals = 7) {
  if (!balance || balance === '0') return '0.00';

  const num = parseFloat(balance);
  if (num < 0.01) {
    return num.toFixed(decimals);
  } else if (num < 1000) {
    return num.toFixed(2);
  } else {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

function formatXLM(amount) {
  if (!amount) return '0.00 XLM';
  return `${formatBalance(amount)} XLM`;
}

// 주소 축약
function shortenAddress(address, chars = 6) {
  if (!address) return '';
  if (address.length <= chars * 2) return address;

  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// 시간 포맷팅
function getTimeAgo(timestamp) {
  const now = Date.now();
  const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  const diff = now - time;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

// 유효성 검증
function isValidAddress(address) {
  if (!address || typeof address !== 'string') return false;
  return /^G[A-Z2-7]{55}$/.test(address);
}

function isValidAmount(amount, min = 0.0000001) {
  const num = parseFloat(amount);
  return !isNaN(num) && num >= min;
}

function isValidMemo(memo, maxLength = 28) {
  if (!memo) return true;
  return memo.length <= maxLength;
}

// 클립보드 복사
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    }
  } catch (error) {
    console.error('[Helpers] Copy failed:', error);
    return false;
  }
}

// 토스트 메시지
function showToast(message, type = 'info', duration = 3000) {
  // 기존 토스트 제거
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  // 새 토스트 생성
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  // 타입별 배경색 및 텍스트 색상
  const styles = {
    success: { background: '#4CAF50', color: 'white' },
    error: { background: '#F44336', color: 'white' },
    warning: { background: '#FF9800', color: 'white' },
    info: { background: '#2196F3', color: 'white' }
  };

  const style = styles[type] || { background: '#333', color: 'white' };
  toast.style.background = style.background;
  toast.style.color = style.color;

  document.body.appendChild(toast);

  // 자동 제거
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// QR 코드 생성 (외부 라이브러리 필요시)
async function generateQRCode(text, size = 256) {
  try {
    // QRCode.js 라이브러리 사용 (있는 경우)
    if (window.QRCode) {
      const qr = document.createElement('div');
      new window.QRCode(qr, {
        text: text,
        width: size,
        height: size,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.L
      });
      return qr.querySelector('canvas').toDataURL();
    }

    // 또는 API 사용
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
  } catch (error) {
    console.error('[Helpers] QR generation failed:', error);
    return null;
  }
}

// 단위 변환
function stroopsToXLM(stroops) {
  return (parseInt(stroops) / 10000000).toString();
}

function xlmToStroops(xlm) {
  return Math.floor(parseFloat(xlm) * 10000000).toString();
}

// 네트워크 상태 확인
async function checkNetworkStatus() {
  try {
    const horizonUrl = window.StellarConfig?.getHorizonUrl();
    if (!horizonUrl) return false;

    // Horizon API는 HEAD를 지원하지 않음 - GET 사용
    const response = await fetch(horizonUrl);
    return response.ok;
  } catch (error) {
    // 네트워크 에러는 false로 처리
    return false;
  }
}

// Testnet 펀딩
async function fundTestAccount(address) {
  try {
    const network = window.StellarConfig?.getCurrentNetwork();
    if (!network || !network.friendbotUrl) {
      showToast('Funding only available on testnet/futurenet', 'warning');
      return false;
    }

    const response = await fetch(`${network.friendbotUrl}?addr=${encodeURIComponent(address)}`);

    if (response.ok) {
      showToast('Account funded successfully!', 'success');
      return true;
    } else if (response.status === 400) {
      const text = await response.text();
      if (text.includes('already exist')) {
        showToast('Account already exists', 'info');
      } else {
        showToast('Funding failed', 'error');
      }
      return false;
    }

    showToast('Funding failed', 'error');
    return false;

  } catch (error) {
    console.error('[Helpers] Funding failed:', error);
    showToast('Network error during funding', 'error');
    return false;
  }
}

// 가격 데이터 가져오기
async function fetchPriceData() {
  try {
    const url = window.StellarConfig?.API_CONFIG?.PRICE_API;
    if (!url) return null;

    const response = await fetch(url);
    const data = await response.json();

    if (data && data.stellar) {
      return data.stellar.usd;
    }
    return null;
  } catch (error) {
    console.error('[Helpers] Price fetch failed:', error);
    return null;
  }
}

// 전역 노출
window.StellarUtils = {
  formatBalance,
  formatXLM,
  shortenAddress,
  getTimeAgo,
  isValidAddress,
  isValidAmount,
  isValidMemo,
  copyToClipboard,
  showToast,
  generateQRCode,
  stroopsToXLM,
  xlmToStroops,
  checkNetworkStatus,
  fundTestAccount,
  fetchPriceData
};

console.log('[Stellar2] Helpers loaded');