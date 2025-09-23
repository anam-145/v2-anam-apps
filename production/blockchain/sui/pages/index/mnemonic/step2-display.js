// Sui Mnemonic Flow - Step 2: Mnemonic Display
// Mnemonic display screen component

class MnemonicDisplayStep {
  constructor(flowManager) {
    this.flowManager = flowManager;
    this.copied = false;
  }

  render() {
    const words = this.flowManager.mnemonic.split(' ');
    
    return `
      <div class="mnemonic-step" data-step="2">
        <div class="step-header">
          <button class="back-btn" id="back-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <span class="step-indicator">Step 2 of 3</span>
          <h2 class="step-title">Write Down Your Recovery Phrase</h2>
        </div>
        
        <div class="step-content">
          <p class="description">
            This is your Secret Recovery Phrase. Write it down in the correct order and store it safely.
          </p>
          
          <div class="security-notice">
            <span class="lock-icon"></span>
            <span>Never share this with anyone.</span>
          </div>
          
          <div class="mnemonic-container">
            <div class="mnemonic-grid">
              ${words.map((word, i) => `
                <div class="mnemonic-word">
                  <span class="word-number">${i + 1}</span>
                  <span class="word-text">${word}</span>
                </div>
              `).join('')}
            </div>
            
            <div class="mnemonic-actions">
              <button class="btn-copy" id="copy-btn">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="7" y="7" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M4 13V4C4 3.44772 4.44772 3 5 3H14" stroke="currentColor" stroke-width="1.5"/>
                </svg>
                <span id="copy-text">Copy to Clipboard</span>
              </button>
            </div>
          </div>
          
          <div class="warning-tips">
            <h4>Safe Storage Tips:</h4>
            <ul>
              <li>Write it on paper and keep it in a safe place</li>
              <li>Store copies in multiple secure locations</li>
              <li>Share with trusted family members if necessary</li>
            </ul>
            
            <h4 class="danger-title">Never Do This:</h4>
            <ul class="danger-list">
              <li>Save in online notes or cloud storage</li>
              <li>Send via email or messenger</li>
              <li>Take a screenshot</li>
              <li>Read aloud in public places</li>
            </ul>
          </div>
        </div>
        
        <div class="step-actions">
          <button class="btn btn-primary" id="next-btn">
            Continue
          </button>
        </div>
      </div>
    `;
  }

  attachEvents() {
    // Back button
    document.getElementById('back-btn').addEventListener('click', () => {
      this.handleBack();
    });

    // Copy button
    document.getElementById('copy-btn').addEventListener('click', () => {
      this.handleCopy();
    });

    // Next button
    document.getElementById('next-btn').addEventListener('click', () => {
      this.handleNext();
    });
  }

  handleBack() {
    // Confirm going back
    if (!this.copied || confirm('Have you saved your recovery phrase? Going back will generate a new one.')) {
      // Reset mnemonic and start over
      this.flowManager.reset();
      this.flowManager.showStep(1);
    }
  }

  async handleCopy() {
    try {
      await navigator.clipboard.writeText(this.flowManager.mnemonic);
      
      // Change button state
      const copyBtn = document.getElementById('copy-btn');
      const copyText = document.getElementById('copy-text');
      
      copyBtn.classList.add('copied');
      copyText.textContent = 'Copied!';
      
      // Set copy flag
      this.copied = true;
      
      // Toast message
      if (window.showToast) {
        window.showToast('Recovery phrase copied. Store it in a safe place!', 'success', 4000);
      }
      
      // Reset after 3 seconds
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyText.textContent = 'Copy to Clipboard';
      }, 3000);
      
      // Log copy event (for security audit)
      const event = {
        action: 'mnemonic_copied',
        timestamp: new Date().toISOString(),
        wallet: this.flowManager.wallet.address.substring(0, 10) + '...'
      };
      console.log('Security Event:', event);
      
    } catch (err) {
      console.log('Failed to copy:', err);
      if (window.showToast) {
        window.showToast('Failed to copy. Please write it down manually.', 'error');
      }
    }
  }

  handleNext() {
    // 바로 다음 단계로 이동
    this.flowManager.showStep(3);
  }
}

// Export for use in mnemonic-flow.js
if (typeof window !== 'undefined') {
  window.MnemonicDisplayStep = MnemonicDisplayStep;
}