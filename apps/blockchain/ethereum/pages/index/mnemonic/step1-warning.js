// Ethereum Mnemonic Flow - Step 1: Security Warning
// Security warning screen component

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
          <span class="step-indicator">Step 1 of 3</span>
          <h2 class="step-title">Secure Your Wallet</h2>
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
            Secure your wallet by saving your Secret Recovery Phrase in a trusted place.
          </p>
          
          <div class="warning-box">
            <span class="warning-icon">!</span>
            <div class="warning-text">
              <p>This is the only way to recover your wallet if your app is locked or you get a new device.</p>
            </div>
          </div>
          
          <div class="info-list">
            <div class="info-item">
              <span class="info-icon"></span>
              <span>Your recovery phrase consists of 12 English words</span>
            </div>
            <div class="info-item">
              <span class="info-icon"></span>
              <span>Write it down on paper and keep it in a safe place</span>
            </div>
            <div class="info-item">
              <span class="info-icon"></span>
              <span>Never save it online or as a screenshot</span>
            </div>
          </div>
        </div>
        
        <div class="step-actions">
          <button class="btn btn-secondary" id="skip-btn">
            Remind Me Later
          </button>
          <button class="btn btn-primary" id="continue-btn">
            Start Securing
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
    // Increment skip count
    const skipCount = parseInt(localStorage.getItem('eth_mnemonic_skip_count') || '0') + 1;
    localStorage.setItem('eth_mnemonic_skip_count', skipCount.toString());
    localStorage.setItem('eth_mnemonic_skipped', 'true');
    
    // Toast message
    if (window.showToast) {
      window.showToast('You can secure your wallet later.', 'info');
    }
    
    // Create wallet (without mnemonic backup)
    this.flowManager.skipAndCreateWallet();
  }

  async handleContinue() {
    try {
      // Show loading state
      const continueBtn = document.getElementById('continue-btn');
      const originalText = continueBtn.textContent;
      continueBtn.disabled = true;
      continueBtn.innerHTML = '<span class="spinner"></span> Creating wallet...';
      
      // Generate wallet
      await this.flowManager.generateWallet();
      
      // Restore button
      continueBtn.disabled = false;
      continueBtn.textContent = originalText;
      
      // Move to next step
      this.flowManager.showStep(2);
    } catch (error) {
      console.log('Failed to generate wallet:', error);
      if (window.showToast) {
        window.showToast('Failed to create wallet. Please try again.', 'error');
      }
      
      // Restore button
      const continueBtn = document.getElementById('continue-btn');
      continueBtn.disabled = false;
      continueBtn.innerHTML = 'Start Securing';
    }
  }
}

// Export for use in mnemonic-flow.js
if (typeof window !== 'undefined') {
  window.SecurityWarningStep = SecurityWarningStep;
}