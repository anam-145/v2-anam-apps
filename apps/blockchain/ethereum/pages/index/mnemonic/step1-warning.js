// Ethereum Mnemonic Flow - Step 1: Security Warning
// 보안 경고 화면 컴포넌트

class SecurityWarningStep {
  constructor(flowManager) {
    this.flowManager = flowManager;
  }

  render() {
    return `
      <div class="mnemonic-step" data-step="1">
        <div class="step-header">
          <button class="back-btn" id="back-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <span class="step-indicator">1단계/3단계</span>
          <h2 class="step-title">지갑 보호하기</h2>
        </div>
        
        <div class="step-content">
          <div class="security-icon">
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="20" y="40" width="80" height="60" rx="8" fill="#E5E7EB"/>
              <rect x="30" y="30" width="60" height="70" rx="8" fill="#9CA3AF"/>
              <rect x="40" y="20" width="40" height="80" rx="8" fill="#6B7280"/>
              <circle cx="60" cy="60" r="8" fill="#FFF"/>
              <rect x="56" y="60" width="8" height="20" fill="#FFF"/>
            </svg>
          </div>
          
          <p class="main-message">
            자산을 잃지 않으려면 비밀복구구문을(를) 신뢰할 수 있는 장소에 저장해 지갑을 보호하세요.
          </p>
          
          <div class="warning-box">
            <span class="warning-icon">⚠️</span>
            <div class="warning-text">
              <p>앱이 잠기거나 새 기기를 사용할 때 지갑을 복구할 수 있는 유일한 방법입니다.</p>
            </div>
          </div>
          
          <div class="info-list">
            <div class="info-item">
              <span class="info-icon">🔐</span>
              <span>비밀복구구문은 12개의 영어 단어로 구성됩니다</span>
            </div>
            <div class="info-item">
              <span class="info-icon">📝</span>
              <span>종이에 적어 안전한 곳에 보관하세요</span>
            </div>
            <div class="info-item">
              <span class="info-icon">🚫</span>
              <span>절대 온라인이나 스크린샷으로 저장하지 마세요</span>
            </div>
          </div>
        </div>
        
        <div class="step-actions">
          <button class="btn btn-secondary" id="skip-btn">
            나중에 알림받기
          </button>
          <button class="btn btn-primary" id="continue-btn">
            지갑 보호 시작
          </button>
        </div>
      </div>
    `;
  }

  attachEvents() {
    // 뒤로가기 버튼
    document.getElementById('back-btn').addEventListener('click', () => {
      this.handleBack();
    });

    // 나중에 알림받기 버튼
    document.getElementById('skip-btn').addEventListener('click', () => {
      this.handleSkip();
    });

    // 계속 버튼
    document.getElementById('continue-btn').addEventListener('click', async () => {
      await this.handleContinue();
    });
  }

  handleBack() {
    // 플로우 종료하고 첫 화면으로
    this.flowManager.close();
  }

  handleSkip() {
    // 스킵 횟수 증가
    const skipCount = parseInt(localStorage.getItem('eth_mnemonic_skip_count') || '0') + 1;
    localStorage.setItem('eth_mnemonic_skip_count', skipCount.toString());
    localStorage.setItem('eth_mnemonic_skipped', 'true');
    
    // 토스트 메시지
    if (window.showToast) {
      window.showToast('나중에 지갑을 보호하실 수 있습니다.', 'info');
    }
    
    // 지갑 생성 (니모닉 백업 없이)
    this.flowManager.skipAndCreateWallet();
  }

  async handleContinue() {
    try {
      // 로딩 상태 표시
      const continueBtn = document.getElementById('continue-btn');
      const originalText = continueBtn.textContent;
      continueBtn.disabled = true;
      continueBtn.innerHTML = '<span class="spinner"></span> 지갑 생성 중...';
      
      // 지갑 생성
      await this.flowManager.generateWallet();
      
      // 버튼 복원
      continueBtn.disabled = false;
      continueBtn.textContent = originalText;
      
      // 다음 단계로 이동
      this.flowManager.showStep(2);
    } catch (error) {
      console.error('Failed to generate wallet:', error);
      if (window.showToast) {
        window.showToast('지갑 생성에 실패했습니다. 다시 시도해주세요.', 'error');
      }
      
      // 버튼 복원
      const continueBtn = document.getElementById('continue-btn');
      continueBtn.disabled = false;
      continueBtn.innerHTML = '지갑 보호 시작';
    }
  }
}

// Export for use in mnemonic-flow.js
if (typeof window !== 'undefined') {
  window.SecurityWarningStep = SecurityWarningStep;
}