// Send 페이지 로직

// 전역 변수
let adapter = null;
let currentWallet = null;

// Utils 함수 가져오기
const { showToast, formatBalance, isValidAddress } = window.EthereumUtils || {};

// 페이지 초기화
document.addEventListener("DOMContentLoaded", function () {
  console.log("Send page loaded");

  // 지갑 정보 로드
  loadWalletInfo();

  // Ethereum 어댑터 초기화
  adapter = window.getAdapter();
  
  if (!adapter) {
    console.log("EthereumAdapter not initialized");
    showToast("Failed to initialize Ethereum adapter");
  }

  // UI 초기화
  updateUI();
  
  // Check URL parameters (address from QR code)
  checkUrlParameters();
});

// 지갑 정보 로드
function loadWalletInfo() {
  const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
  const walletData = localStorage.getItem(walletKey);

  if (walletData) {
    currentWallet = JSON.parse(walletData);
    console.log("Wallet loaded:", currentWallet.address);
  } else {
    showToast("No wallet found");
    goBack();
  }
}

// UI 업데이트
async function updateUI() {
  // 코인 심볼 업데이트
  document.querySelectorAll('.coin-symbol').forEach(el => {
    el.textContent = CoinConfig.symbol;
  });

  // 타이틀 업데이트
  document.title = `Send ${CoinConfig.name}`;

  // 잔액 업데이트
  if (currentWallet && adapter) {
    try {
      const balance = await adapter.getBalance(currentWallet.address);
      const formattedBalance = formatBalance ? formatBalance(balance) : balance;
      document.getElementById('available-balance').textContent = formattedBalance;
    } catch (error) {
      console.log("Failed to fetch balance:", error);
    }
  }
}

// 뒤로 가기
function goBack() {
  // blockchain miniapp은 anamUI 네임스페이스 사용
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo('pages/index/index');
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo('pages/index/index');
  } else {
    // 개발 환경: 일반 HTML 페이지 이동
    window.location.href = '../index/index.html';
  }
}

// 전송 확인
async function confirmSend() {
  if (!currentWallet || !adapter) {
    showToast("No wallet found");
    return;
  }

  const recipient = document.getElementById("recipient-address").value.trim();
  const amount = document.getElementById("send-amount").value.trim();
  const feeLevel = document.getElementById("tx-fee").value;

  // 유효성 검증
  if (!recipient || !amount) {
    showToast("Please enter recipient address and amount");
    return;
  }

  if (!isValidAddress(recipient)) {
    showToast("Invalid address format");
    return;
  }

  if (parseFloat(amount) <= 0) {
    showToast("Please enter an amount greater than 0");
    return;
  }

  try {
    showToast("Sending transaction...");

    // 수수료 가져오기
    const gasPrice = await adapter.getGasPrice();
    const fee = gasPrice[feeLevel];

    // 트랜잭션 전송
    const txParams = {
      from: currentWallet.address,
      to: recipient,
      amount: amount,
      privateKey: currentWallet.privateKey,
    };

    // Ethereum 특화 파라미터 추가
    if (feeLevel && fee) {
      txParams.gasPrice = fee; // Gwei 단위
      txParams.gasLimit = 21000; // 기본 ETH 전송 가스 한도
    }

    const result = await adapter.sendTransaction(txParams);

    showToast(`Transaction sent successfully!`);
    console.log("Transaction hash:", result.hash);

    // Pending 트랜잭션을 localStorage에 저장
    const pendingTx = {
      hash: result.hash,
      from: currentWallet.address.toLowerCase(),
      to: recipient.toLowerCase(),
      value: ethers.utils.parseEther(amount).toString(),
      timeStamp: Math.floor(Date.now() / 1000).toString(),
      isPending: true,  // pending 플래그
      gasUsed: "21000",  // 기본 가스
      gasPrice: txParams.gasPrice ? ethers.utils.parseUnits(txParams.gasPrice, 'gwei').toString() : "0"
    };

    // 기존 캐시 가져오기
    const cacheKey = `eth_tx_${currentWallet.address.toLowerCase()}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        const cacheData = JSON.parse(cached);
        if (cacheData.data && Array.isArray(cacheData.data)) {
          // pending 트랜잭션을 맨 앞에 추가
          cacheData.data.unshift(pendingTx);
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          console.log("Pending transaction added to cache");
        }
      } catch (e) {
        console.log("Failed to update cache with pending tx:", e);
      }
    } else {
      // 캐시가 없으면 새로 생성
      const newCache = {
        data: [pendingTx],
        timestamp: Date.now(),
        ttl: 300000  // 5분
      };
      localStorage.setItem(cacheKey, JSON.stringify(newCache));
      console.log("New cache created with pending transaction");
    }

    // 메인 페이지로 돌아가기
    setTimeout(() => {
      goBack();
    }, 2000);

  } catch (error) {
    console.log("Transaction failed:", error);
    showToast("Transaction failed: " + error.message);
  }
}

// URL 파라미터에서 주소 가져오기
function checkUrlParameters() {
  // 현재 URL 가져오기
  const urlParams = new URLSearchParams(window.location.search);
  const address = urlParams.get('address');
  
  if (address) {
    console.log("Address from QR code:", address);
    
    // 주소 입력란에 자동 입력
    const addressInput = document.getElementById('recipient-address');
    if (addressInput) {
      addressInput.value = address;
      console.log("Address auto-filled in recipient field");
      
      // 주소가 채워졌음을 사용자에게 알림
      showToast("Address imported from QR code");
      
      // 금액 입력란으로 포커스 이동
      const amountInput = document.getElementById('send-amount');
      if (amountInput) {
        amountInput.focus();
      }
    }
  }
}

// QR 코드 스캔 함수
function scanQRCode() {
  console.log("scanQRCode() called from send page");
  
  // anamUI API 확인 (블록체인 미니앱에서 사용)
  if (window.anamUI && window.anamUI.scanQRCode) {
    console.log("Using anamUI.scanQRCode API");
    
    // QR 스캔 결과 이벤트 리스너 등록
    window.addEventListener('qrScanned', handleQRScanned);
    
    // QR 스캐너 호출 - 메인 프로세스에서 카메라 실행
    window.anamUI.scanQRCode(JSON.stringify({
      title: "Scan QR Code",
      description: "Scan recipient's wallet address QR code"
    }));
    
    console.log("QR scanner requested to main process");
  } else {
    console.log("anamUI.scanQRCode API not available");
    showToast("QR scan feature is not available");
    
    // 개발 환경에서 테스트용
    const testAddress = prompt("Enter address (development mode):");
    if (testAddress) {
      document.getElementById("recipient-address").value = testAddress;
    }
  }
}

// QR 스캔 결과 처리
function handleQRScanned(event) {
  console.log("QR scan event received:", event);
  
  // 이벤트 리스너 제거 (일회성)
  window.removeEventListener('qrScanned', handleQRScanned);
  
  if (event.detail && event.detail.success) {
    const qrData = event.detail.data;
    console.log("QR scan success:", qrData);
    
    // 이더리움 주소 형식 확인 (0x로 시작하는 42자)
    if (qrData && qrData.match(/^0x[a-fA-F0-9]{40}$/)) {
      // 주소 필드에 입력
      document.getElementById("recipient-address").value = qrData;
      showToast("Address imported successfully");
      
      // 금액 입력란으로 포커스 이동
      const amountInput = document.getElementById('send-amount');
      if (amountInput) {
        amountInput.focus();
      }
    } else {
      console.log("Invalid Ethereum address format:", qrData);
      showToast("Invalid address format");
    }
  } else {
    const error = event.detail ? event.detail.error : "Unknown error";
    console.log("QR scan failed:", error);
    showToast("QR scan failed: " + error);
  }
}

// HTML onclick을 위한 전역 함수 등록
window.goBack = goBack;
window.confirmSend = confirmSend;
window.scanQRCode = scanQRCode;