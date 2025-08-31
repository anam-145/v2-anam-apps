// Ethereum Mnemonic Flow - Step 3: Mnemonic Verification
// 니모닉 검증 화면 컴포넌트

class MnemonicVerifyStep {
  constructor(flowManager) {
    this.flowManager = flowManager;
    this.selectedWords = {};
    this.currentBlankIndex = 0;
    this.verificationAttempts = 0;
    this.maxAttempts = 3;
  }

  render() {
    const words = this.flowManager.mnemonic.split(' ');
    const verifyIndices = this.flowManager.verificationIndices;
    
    // 선택지 생성 (정답 + 더미 단어)
    const wordBank = this.createWordBank(words, verifyIndices);
    
    return `
      <div class="mnemonic-step" data-step="3">
        <div class="step-header">
          <button class="back-btn" id="back-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <span class="step-indicator">3단계/3단계</span>
          <h2 class="step-title">비밀복구구문 컨펌</h2>
        </div>
        
        <div class="step-content">
          <p class="description">
            빠진 단어를 올바른 순서로 선택하세요.
          </p>
          
          <div class="verification-container">
            <div class="verification-grid">
              ${words.map((word, i) => {
                const isBlank = verifyIndices.includes(i);
                const blankIndex = verifyIndices.indexOf(i);
                
                return `
                  <div class="verification-word ${isBlank ? 'is-blank' : 'is-hidden'}">
                    <span class="word-number">${i + 1}.</span>
                    ${isBlank 
                      ? `<span class="word-slot" data-index="${i}" data-blank-index="${blankIndex}" id="slot-${i}">
                          <span class="slot-placeholder">선택하세요</span>
                        </span>`
                      : `<span class="word-hidden">••••••</span>`
                    }
                  </div>
                `;
              }).join('')}
            </div>
            
            <div class="word-selection">
              <p class="selection-hint">아래에서 올바른 단어를 선택하세요:</p>
              <div class="word-bank" id="word-bank">
                ${wordBank.map(word => `
                  <button class="word-option" data-word="${word}">
                    ${word}
                  </button>
                `).join('')}
              </div>
            </div>
            
            <div class="verification-status" id="verification-status" style="display: none;">
              <div class="status-content"></div>
            </div>
          </div>
          
          <div class="attempts-info">
            <p>시도 횟수: <span id="attempts">${this.verificationAttempts}</span>/${this.maxAttempts}</p>
          </div>
        </div>
        
        <div class="step-actions">
          <button class="btn btn-secondary" id="reset-btn" style="display: none;">
            다시 시도
          </button>
          <button class="btn btn-primary" id="complete-btn" disabled>
            지갑 생성 완료
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

    // 단어 선택 이벤트
    document.querySelectorAll('.word-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectWord(e.target.dataset.word, e.target);
      });
    });

    // 다시 시도 버튼
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetVerification();
      });
    }

    // 완료 버튼
    document.getElementById('complete-btn').addEventListener('click', () => {
      this.handleComplete();
    });

    // 빈칸 클릭 이벤트 (선택 취소)
    document.querySelectorAll('.word-slot').forEach(slot => {
      slot.addEventListener('click', (e) => {
        this.deselectWord(e.currentTarget);
      });
    });
  }

  handleBack() {
    this.flowManager.showStep(2);
  }

  selectWord(word, buttonElement) {
    // 다음 빈칸 찾기
    const verifyIndices = this.flowManager.verificationIndices;
    const nextBlankIndex = verifyIndices[this.currentBlankIndex];
    
    if (nextBlankIndex === undefined) {
      // 모든 빈칸이 채워짐
      return;
    }
    
    // 슬롯에 단어 채우기
    const slot = document.getElementById(`slot-${nextBlankIndex}`);
    slot.innerHTML = `<span class="selected-word">${word}</span>`;
    slot.classList.add('filled');
    slot.dataset.selectedWord = word;
    slot.dataset.selectedButton = buttonElement.dataset.word;
    
    // 버튼 비활성화
    buttonElement.disabled = true;
    buttonElement.classList.add('selected');
    
    // 선택 저장
    this.selectedWords[nextBlankIndex] = word;
    this.currentBlankIndex++;
    
    // 모두 선택했는지 확인
    if (this.currentBlankIndex === verifyIndices.length) {
      this.validateSelection();
    }
  }

  deselectWord(slot) {
    if (!slot.classList.contains('filled')) return;
    
    const word = slot.dataset.selectedWord;
    const index = parseInt(slot.dataset.index);
    
    // 슬롯 초기화
    slot.innerHTML = '<span class="slot-placeholder">선택하세요</span>';
    slot.classList.remove('filled', 'correct', 'incorrect');
    delete slot.dataset.selectedWord;
    
    // 버튼 다시 활성화
    const button = document.querySelector(`.word-option[data-word="${word}"]`);
    if (button) {
      button.disabled = false;
      button.classList.remove('selected');
    }
    
    // 선택 제거
    delete this.selectedWords[index];
    
    // currentBlankIndex 업데이트
    const verifyIndices = this.flowManager.verificationIndices;
    this.currentBlankIndex = verifyIndices.findIndex(idx => !this.selectedWords.hasOwnProperty(idx));
    if (this.currentBlankIndex === -1) {
      this.currentBlankIndex = verifyIndices.length;
    }
    
    // 상태 초기화
    document.getElementById('verification-status').style.display = 'none';
    document.getElementById('complete-btn').disabled = true;
  }

  validateSelection() {
    const words = this.flowManager.mnemonic.split(' ');
    const verifyIndices = this.flowManager.verificationIndices;
    
    // 정답 확인
    let allCorrect = true;
    verifyIndices.forEach(index => {
      const isCorrect = this.selectedWords[index] === words[index];
      const slot = document.getElementById(`slot-${index}`);
      
      if (isCorrect) {
        slot.classList.add('correct');
      } else {
        slot.classList.add('incorrect');
        allCorrect = false;
      }
    });
    
    const statusDiv = document.getElementById('verification-status');
    const statusContent = statusDiv.querySelector('.status-content');
    
    if (allCorrect) {
      // 성공
      statusContent.innerHTML = `
        <div class="success-message">
          <span class="success-icon">✅</span>
          <span>올바르게 선택했습니다!</span>
        </div>
      `;
      statusDiv.className = 'verification-status success';
      statusDiv.style.display = 'block';
      
      // 완료 버튼 활성화
      document.getElementById('complete-btn').disabled = false;
      
      // 토스트 메시지
      if (window.showToast) {
        window.showToast('✅ 비밀복구구문이 확인되었습니다!', 'success');
      }
    } else {
      // 실패
      this.verificationAttempts++;
      document.getElementById('attempts').textContent = this.verificationAttempts;
      
      if (this.verificationAttempts >= this.maxAttempts) {
        // 최대 시도 횟수 초과
        statusContent.innerHTML = `
          <div class="error-message">
            <span class="error-icon">❌</span>
            <span>최대 시도 횟수를 초과했습니다. 처음부터 다시 시작해주세요.</span>
          </div>
        `;
        statusDiv.className = 'verification-status error';
        
        // 처음으로 돌아가기
        setTimeout(() => {
          this.flowManager.reset();
          this.flowManager.showStep(1);
        }, 3000);
      } else {
        // 재시도 가능
        statusContent.innerHTML = `
          <div class="warning-message">
            <span class="warning-icon">⚠️</span>
            <span>잘못된 단어입니다. 다시 시도하세요. (${this.maxAttempts - this.verificationAttempts}회 남음)</span>
          </div>
        `;
        statusDiv.className = 'verification-status warning';
        
        // 다시 시도 버튼 표시
        document.getElementById('reset-btn').style.display = 'inline-block';
      }
      
      statusDiv.style.display = 'block';
      
      // 토스트 메시지
      if (window.showToast) {
        window.showToast(`❌ 잘못된 단어입니다. (${this.maxAttempts - this.verificationAttempts}회 남음)`, 'error');
      }
    }
  }

  resetVerification() {
    // 모든 슬롯 초기화
    this.flowManager.verificationIndices.forEach(index => {
      const slot = document.getElementById(`slot-${index}`);
      slot.innerHTML = '<span class="slot-placeholder">선택하세요</span>';
      slot.classList.remove('filled', 'correct', 'incorrect');
      delete slot.dataset.selectedWord;
    });
    
    // 모든 버튼 활성화
    document.querySelectorAll('.word-option').forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('selected');
    });
    
    // 상태 초기화
    this.selectedWords = {};
    this.currentBlankIndex = 0;
    document.getElementById('verification-status').style.display = 'none';
    document.getElementById('reset-btn').style.display = 'none';
    document.getElementById('complete-btn').disabled = true;
  }

  createWordBank(words, verifyIndices) {
    // 정답 단어들
    const correctWords = verifyIndices.map(i => words[i]);
    
    // BIP39 더미 단어들 (이더리움에서 자주 사용되는 단어들)
    const dummyWords = [
      'abandon', 'ability', 'able', 'about', 'above', 'absent',
      'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident',
      'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire',
      'across', 'act', 'action', 'actor', 'actress', 'actual'
    ];
    
    // 정답과 겹치지 않는 더미 단어 선택
    const availableDummies = dummyWords.filter(w => 
      !correctWords.includes(w) && !words.includes(w)
    );
    
    // 랜덤으로 6개 더미 단어 선택
    const randomDummies = [];
    while (randomDummies.length < 6 && availableDummies.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableDummies.length);
      randomDummies.push(availableDummies.splice(randomIndex, 1)[0]);
    }
    
    // 섞어서 반환
    return [...correctWords, ...randomDummies].sort(() => Math.random() - 0.5);
  }

  async handleComplete() {
    try {
      // 로딩 상태
      const completeBtn = document.getElementById('complete-btn');
      completeBtn.disabled = true;
      completeBtn.innerHTML = '<span class="spinner"></span> 지갑 생성 중...';
      
      // 지갑 완료 처리
      await this.flowManager.completeFlow();
      
      // 성공 메시지
      if (window.showToast) {
        window.showToast('🎉 지갑이 성공적으로 생성되었습니다!', 'success', 5000);
      }
    } catch (error) {
      console.error('Failed to complete wallet creation:', error);
      if (window.showToast) {
        window.showToast('지갑 생성에 실패했습니다. 다시 시도해주세요.', 'error');
      }
      
      // 버튼 복원
      const completeBtn = document.getElementById('complete-btn');
      completeBtn.disabled = false;
      completeBtn.innerHTML = '지갑 생성 완료';
    }
  }
}

// Export for use in mnemonic-flow.js
if (typeof window !== 'undefined') {
  window.MnemonicVerifyStep = MnemonicVerifyStep;
}