// ================================================================
// Liberia Stellar - Settings Page
// deriveKey API 사용 - 네트워크 스위칭 전용
// ================================================================

let currentWallet = null;
let adapter = null;

// Utils 함수 가져오기 (StellarUtils 우선)
const { showToast } = window.StellarUtils || window.LiberiaUtils || {};

// ================================================================
// 초기화
// ================================================================

document.addEventListener("DOMContentLoaded", function () {
  console.log("[LiberiaStellar] Settings page loaded");

  // Adapter 초기화
  adapter = window.getAdapter();

  // 지갑 데이터 로드
  loadWalletData();

  // 테마 적용
  applyTheme();

  // 네트워크 표시 업데이트
  updateNetworkDisplay();

  // Faucet 섹션 표시 여부
  updateFaucetSection();
});

// ================================================================
// 테마 적용
// ================================================================

function applyTheme() {
  const root = document.documentElement;
  const config = window.CoinConfig;

  if (config && config.theme) {
    root.style.setProperty("--coin-primary", config.theme.primaryColor);
    root.style.setProperty("--coin-secondary", config.theme.secondaryColor);
  }
}

// ================================================================
// 지갑 데이터 로드
// ================================================================

function loadWalletData() {
  currentWallet = WalletStorage.get();

  if (!currentWallet) {
    showToast && showToast("No wallet found", "error");
    setTimeout(navigateBack, 1500);
  }
}

// ================================================================
// 네비게이션
// ================================================================

function navigateBack() {
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo('pages/index/index');
  } else {
    window.location.href = "../index/index.html";
  }
}

// ================================================================
// 네트워크 관리
// ================================================================

function updateNetworkDisplay() {
  const displayElement = document.getElementById("current-network-name");
  if (displayElement) {
    const currentNetwork = window.LiberiaConfig?.getCurrentNetwork();
    displayElement.textContent = currentNetwork?.displayName || "Stellar Testnet";
  }

  // 체크마크 업데이트
  updateNetworkCheckmarks();
}

function updateNetworkCheckmarks() {
  const activeNetwork = window.LiberiaConfig?.getActiveNetwork() || "testnet";

  // 모든 체크마크 숨기기
  document.querySelectorAll(".network-check").forEach(el => {
    el.style.display = "none";
  });

  // 현재 네트워크 체크마크만 표시
  const activeCheck = document.getElementById(`${activeNetwork}-check`);
  if (activeCheck) {
    activeCheck.style.display = "flex";
  }
}

function updateFaucetSection() {
  const faucetSection = document.getElementById("faucet-section");
  const currentNetwork = window.LiberiaConfig?.getCurrentNetwork();

  if (faucetSection && currentNetwork) {
    // testnet, futurenet에서만 faucet 섹션 표시
    if (currentNetwork.friendbotUrl) {
      faucetSection.style.display = "block";
    } else {
      faucetSection.style.display = "none";
    }
  }
}

function showNetworkSelector() {
  const modal = document.getElementById("network-modal");
  if (modal) {
    modal.style.display = "flex";
    updateNetworkCheckmarks();
  }
}

function closeNetworkModal() {
  const modal = document.getElementById("network-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

function selectNetwork(networkId) {
  console.log("[LiberiaStellar] Selecting network:", networkId);

  const success = window.LiberiaConfig?.setActiveNetwork(networkId);

  if (success) {
    showToast && showToast(`Switched to ${networkId}`, "success");

    // UI 업데이트
    updateNetworkDisplay();
    updateFaucetSection();

    // Adapter 재초기화
    if (adapter && adapter.initializeServer) {
      adapter.initializeServer();
    }

    // 모달 닫기
    closeNetworkModal();
  } else {
    showToast && showToast("Failed to switch network", "error");
  }
}

// ================================================================
// Testnet Faucet
// ================================================================

async function fundAccount() {
  if (!currentWallet) {
    showToast && showToast("No wallet found", "error");
    return;
  }

  const network = window.LiberiaConfig?.getCurrentNetwork();

  if (!network || !network.friendbotUrl) {
    showToast && showToast("Faucet not available on this network", "warning");
    return;
  }

  showToast && showToast("Requesting funds...", "info");

  try {
    const response = await fetch(
      `${network.friendbotUrl}?addr=${encodeURIComponent(currentWallet.address)}`
    );

    if (response.ok) {
      showToast && showToast("Account funded successfully! (10,000 XLM)", "success");
      // 캐시 클리어
      window.LiberiaConfig?.clearNetworkCache();
    } else {
      const text = await response.text();
      if (text.includes("already exist")) {
        showToast && showToast("Account already exists - funding only once", "info");
      } else {
        showToast && showToast("Funding failed", "error");
      }
    }
  } catch (error) {
    console.log("[LiberiaStellar] Fund account failed:", error);
    showToast && showToast("Failed to fund account", "error");
  }
}

// ================================================================
// 모달 외부 클릭 시 닫기
// ================================================================

window.addEventListener("click", function(event) {
  const networkModal = document.getElementById("network-modal");

  if (event.target === networkModal) {
    closeNetworkModal();
  }
});

// ================================================================
// 전역 함수 등록
// ================================================================

window.navigateBack = navigateBack;
window.showNetworkSelector = showNetworkSelector;
window.closeNetworkModal = closeNetworkModal;
window.selectNetwork = selectNetwork;
window.fundAccount = fundAccount;

console.log("[LiberiaStellar] Settings page script loaded");
