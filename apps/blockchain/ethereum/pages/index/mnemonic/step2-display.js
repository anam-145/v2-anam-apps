// Ethereum Mnemonic Flow - Step 2: Mnemonic Display
// 니모닉 표시 화면 컴포넌트

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
          <span class="step-indicator">2단계/3단계</span>
          <h2 class="step-title">비밀복구구문을 저장하세요</h2>
        </div>
        
        <div class="step-content">
          <p class="description">
            이것이 회원님의 비밀복구구문입니다. 올바른 순서로 적어두고 안전하게 보관하세요.
          </p>
          
          <div class="security-notice">
            <span class="lock-icon">🔒</span>
            <span>절대 누구와도 공유하지 마세요.</span>
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
                <span id="copy-text">클립보드에 복사</span>
              </button>
            </div>
          </div>
          
          <div class="warning-tips">
            <h4>안전한 보관 방법:</h4>
            <ul>
              <li>종이에 적어서 안전한 곳에 보관</li>
              <li>여러 장소에 나누어 보관</li>
              <li>신뢰할 수 있는 가족과 공유 (필요시)</li>
            </ul>
            
            <h4 class="danger-title">절대 하지 마세요:</h4>
            <ul class="danger-list">
              <li>온라인 메모장이나 클라우드에 저장</li>
              <li>이메일이나 메신저로 전송</li>
              <li>스크린샷으로 저장</li>
              <li>공공장소에서 큰 소리로 읽기</li>
            </ul>
          </div>
        </div>
        
        <div class="step-actions">
          <button class="btn btn-primary" id="next-btn">
            다음
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

    // 복사 버튼
    document.getElementById('copy-btn').addEventListener('click', () => {
      this.handleCopy();
    });

    // 다음 버튼
    document.getElementById('next-btn').addEventListener('click', () => {
      this.handleNext();
    });
  }

  handleBack() {
    // 이전 단계로 돌아가기 확인
    if (!this.copied || confirm('비밀복구구문을 저장하셨나요? 이전 페이지로 돌아가면 다시 생성됩니다.')) {
      // 니모닉 초기화하고 처음부터
      this.flowManager.reset();
      this.flowManager.showStep(1);
    }
  }

  async handleCopy() {
    try {
      await navigator.clipboard.writeText(this.flowManager.mnemonic);
      
      // 버튼 상태 변경
      const copyBtn = document.getElementById('copy-btn');
      const copyText = document.getElementById('copy-text');
      
      copyBtn.classList.add('copied');
      copyText.textContent = '복사됨!';
      
      // 복사 플래그 설정
      this.copied = true;
      
      // 토스트 메시지
      if (window.showToast) {
        window.showToast('📋 복구 문구가 복사되었습니다. 안전한 곳에 보관하세요!', 'success', 4000);
      }
      
      // 3초 후 원래대로
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyText.textContent = '클립보드에 복사';
      }, 3000);
      
      // 복사 이벤트 로깅 (보안 감사용)
      const event = {
        action: 'mnemonic_copied',
        timestamp: new Date().toISOString(),
        wallet: this.flowManager.wallet.address.substring(0, 10) + '...'
      };
      console.log('Security Event:', event);
      
    } catch (err) {
      console.error('Failed to copy:', err);
      if (window.showToast) {
        window.showToast('복사에 실패했습니다. 수동으로 적어주세요.', 'error');
      }
    }
  }

  handleNext() {
    // 복사 여부 확인
    if (!this.copied) {
      // 경고 모달 표시
      const confirmed = confirm(
        '⚠️ 비밀복구구문을 아직 저장하지 않으셨습니다.\n\n' +
        '이 문구 없이는 지갑을 복구할 수 없습니다.\n' +
        '정말 계속하시겠습니까?'
      );
      
      if (!confirmed) {
        return;
      }
    }
    
    // 다음 단계로
    this.flowManager.showStep(3);
  }
}

// Export for use in mnemonic-flow.js
if (typeof window !== 'undefined') {
  window.MnemonicDisplayStep = MnemonicDisplayStep;
}