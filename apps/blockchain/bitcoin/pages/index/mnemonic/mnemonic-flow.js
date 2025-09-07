// Bitcoin Mnemonic Flow Manager
// Manages the entire mnemonic generation flow

class MnemonicFlowManager {
  constructor() {
    this.container = null;
    this.currentStep = 0;
    this.mnemonic = null;
    this.wallet = null;
    this.verificationIndices = [];
    this.isActive = false;
    
    // 각 스텝 컴포넌트
    this.steps = {};
    
    // 초기화
    this.init();
  }

  init() {
    // 컨테이너 생성 또는 찾기
    this.container = document.getElementById('mnemonic-flow-container');
    if (!this.container) {
      // 컨테이너가 없으면 생성
      this.container = document.createElement('div');
      this.container.id = 'mnemonic-flow-container';
      this.container.className = 'mnemonic-flow-container';
      this.container.style.display = 'none';
      document.querySelector('.container').appendChild(this.container);
    }
    
    // 스텝 컴포넌트 초기화
    if (window.SecurityWarningStep) {
      this.steps[1] = new window.SecurityWarningStep(this);
    }
    if (window.MnemonicDisplayStep) {
      this.steps[2] = new window.MnemonicDisplayStep(this);
    }
    if (window.MnemonicVerifyStep) {
      this.steps[3] = new window.MnemonicVerifyStep(this);
    }
  }

  // 플로우 시작
  start() {
    console.log('[MnemonicFlow] Starting mnemonic flow');
    
    // 기존 화면 숨기기
    const creationScreen = document.getElementById('wallet-creation');
    const mainScreen = document.getElementById('wallet-main');
    
    if (creationScreen) creationScreen.style.display = 'none';
    if (mainScreen) mainScreen.style.display = 'none';
    
    // 니모닉 플로우 컨테이너 표시
    this.container.style.display = 'block';
    this.isActive = true;
    
    // 첫 번째 단계 표시
    this.showStep(1);
  }

  // 특정 단계 표시
  showStep(stepNumber) {
    console.log(`[MnemonicFlow] Showing step ${stepNumber}`);
    
    this.currentStep = stepNumber;
    const step = this.steps[stepNumber];
    
    if (!step) {
      console.log(`[MnemonicFlow] Step ${stepNumber} not found`);
      return;
    }
    
    // HTML 렌더링
    this.container.innerHTML = step.render();
    
    // 이벤트 연결
    step.attachEvents();
    
    // 스크롤 최상단으로
    window.scrollTo(0, 0);
  }

  // 지갑 생성
  async generateWallet() {
    try {
      console.log('[MnemonicFlow] Generating wallet...');
      
      // Bitcoin 어댑터 가져오기
      const adapter = window.getAdapter ? window.getAdapter() : null;
      if (!adapter) {
        throw new Error('Bitcoin adapter not found');
      }
      
      // 지갑 생성
      this.wallet = await adapter.generateWallet();
      this.mnemonic = this.wallet.mnemonic;
      
      // 검증용 인덱스 생성 (3개 랜덤 선택)
      this.verificationIndices = this.getRandomIndices(3, 12);
      
      console.log('[MnemonicFlow] Wallet generated successfully');
      console.log('[MnemonicFlow] Verification indices:', this.verificationIndices);
      
      return this.wallet;
    } catch (error) {
      console.log('[MnemonicFlow] Failed to generate wallet:', error);
      throw error;
    }
  }

  // 스킵하고 임시 지갑 생성
  async skipAndCreateWallet() {
    try {
      console.log('[MnemonicFlow] Skipping mnemonic backup...');
      
      // 지갑 생성 (백업 없이)
      await this.generateWallet();
      
      // 지갑 데이터 저장 (백업 미완료 상태로 표시하지만 니모닉은 저장)
      const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
      const walletData = {
        address: this.wallet.address,
        privateKey: this.wallet.privateKey,
        mnemonic: this.wallet.mnemonic,  // 니모닉도 저장 (설정에서 확인 가능)
        mnemonicBackedUp: false,  // 백업 완료 여부는 false
        skippedBackup: true,       // 스킵했음을 표시
        createdAt: new Date().toISOString()
      };
      
      localStorage.setItem(walletKey, JSON.stringify(walletData));
      localStorage.setItem(`${CoinConfig.symbol.toLowerCase()}_wallet_status`, 'pending_backup');
      
      // 플로우 종료하고 메인 화면으로
      this.close();
      
      // 콜백 실행
      if (window.onMnemonicFlowComplete) {
        window.onMnemonicFlowComplete(walletData);
      }
    } catch (error) {
      console.log('[MnemonicFlow] Failed to skip and create wallet:', error);
      if (window.showToast) {
        window.showToast('Failed to create wallet.', 'error');
      }
    }
  }

  // 플로우 완료
  async completeFlow() {
    try {
      console.log('[MnemonicFlow] Completing flow...');
      
      // 지갑 데이터 저장
      const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
      const walletData = {
        address: this.wallet.address,
        privateKey: this.wallet.privateKey,
        mnemonic: this.wallet.mnemonic,
        mnemonicBackedUp: true,
        mnemonicVerified: true,
        createdAt: new Date().toISOString()
      };
      
      localStorage.setItem(walletKey, JSON.stringify(walletData));
      localStorage.setItem(`${CoinConfig.symbol.toLowerCase()}_wallet_status`, 'active');
      
      // 스킵 카운트 초기화
      localStorage.removeItem(`${CoinConfig.symbol.toLowerCase()}_mnemonic_skip_count`);
      localStorage.removeItem(`${CoinConfig.symbol.toLowerCase()}_mnemonic_skipped`);
      
      console.log('[MnemonicFlow] Wallet saved successfully');
      
      // 플로우 종료
      this.close();
      
      // 콜백 실행
      if (window.onMnemonicFlowComplete) {
        window.onMnemonicFlowComplete(walletData);
      }
    } catch (error) {
      console.log('[MnemonicFlow] Failed to complete flow:', error);
      throw error;
    }
  }

  // 플로우 종료
  close() {
    console.log('[MnemonicFlow] Closing flow');
    
    this.isActive = false;
    this.container.style.display = 'none';
    
    // 지갑이 있으면 메인 화면, 없으면 생성 화면으로
    const walletKey = `btc_wallet`;
    const walletData = localStorage.getItem(walletKey);
    
    if (walletData) {
      // 지갑이 있으면 메인 화면 표시
      const mainScreen = document.getElementById('wallet-main');
      if (mainScreen) {
        mainScreen.style.display = 'block';
      }
    } else {
      // 지갑이 없으면 첫 화면(버튼 2개) 표시
      const creationScreen = document.getElementById('wallet-creation');
      if (creationScreen) {
        creationScreen.style.display = 'block';
        // creation-content-metamask 보이기
        const metamaskContent = document.querySelector('.creation-content-metamask');
        if (metamaskContent) {
          metamaskContent.style.display = 'flex';
        }
        // import options 숨기기
        const importOptions = document.getElementById('import-options');
        if (importOptions) {
          importOptions.style.display = 'none';
        }
      }
    }
  }

  // 플로우 리셋
  reset() {
    console.log('[MnemonicFlow] Resetting flow');
    
    this.currentStep = 0;
    this.mnemonic = null;
    this.wallet = null;
    this.verificationIndices = [];
  }

  // 랜덤 인덱스 생성
  getRandomIndices(count, max) {
    const indices = [];
    while (indices.length < count) {
      const rand = Math.floor(Math.random() * max);
      if (!indices.includes(rand)) {
        indices.push(rand);
      }
    }
    return indices.sort((a, b) => a - b);
  }

  // 백업 리마인더 체크
  checkBackupReminder() {
    const walletStatus = localStorage.getItem(`${CoinConfig.symbol.toLowerCase()}_wallet_status`);
    const skipCount = parseInt(localStorage.getItem(`${CoinConfig.symbol.toLowerCase()}_mnemonic_skip_count`) || '0');
    
    if (walletStatus === 'pending_backup' && skipCount > 0) {
      // 스킵 횟수에 따라 리마인더 표시 주기 결정
      const lastReminder = localStorage.getItem(`${CoinConfig.symbol.toLowerCase()}_last_backup_reminder`);
      const now = new Date().getTime();
      const reminderInterval = skipCount * 24 * 60 * 60 * 1000; // 스킵 횟수 * 1일
      
      if (!lastReminder || (now - parseInt(lastReminder)) > reminderInterval) {
        // 리마인더 표시
        this.showBackupReminder();
        localStorage.setItem(`${CoinConfig.symbol.toLowerCase()}_last_backup_reminder`, now.toString());
      }
    }
  }

  // 백업 리마인더 표시
  showBackupReminder() {
    if (window.showToast) {
      window.showToast('Please complete wallet backup. You can check your recovery phrase in settings.', 'warning', 5000);
    }
  }
}

// 전역 인스턴스 생성
if (typeof window !== 'undefined') {
  // DOM이 준비된 후 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.mnemonicFlow = new MnemonicFlowManager();
    });
  } else {
    window.mnemonicFlow = new MnemonicFlowManager();
  }
  
  console.log('[MnemonicFlow] Manager initialized');
}