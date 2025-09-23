// ================================================================
// Solana Web3.js IIFE 번들링
// window.SolanaJS 전역 객체로 노출 (BitcoinJS 패턴 따라감)
// ================================================================

import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  clusterApiUrl
} from '@solana/web3.js';

// 니모닉 관련 라이브러리
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import bs58 from 'bs58';

// ================================================================
// 헬퍼 함수 정의
// ================================================================

// 니모닉으로부터 Keypair 생성
const keypairFromMnemonic = async (mnemonic, accountIndex = 0) => {
  // 니모닉 → 시드 (비동기, 브라우저 호환)
  const seed = await bip39.mnemonicToSeed(mnemonic);

  // Solana 표준 파생 경로
  const path = `m/44'/501'/${accountIndex}'/0'`;
  const derivedSeed = derivePath(path, seed.toString('hex')).key;

  // 시드 → Keypair
  return Keypair.fromSeed(derivedSeed);
};

// 니모닉 생성 (12단어)
const generateMnemonic = () => bip39.generateMnemonic(128);

// 니모닉 검증
const validateMnemonic = (mnemonic) => bip39.validateMnemonic(mnemonic);

// 유틸리티 함수들
const lamportsToSol = (lamports) => lamports / LAMPORTS_PER_SOL;
const solToLamports = (sol) => Math.floor(sol * LAMPORTS_PER_SOL);

// 주소 검증
const isValidAddress = (address) => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

// 주소 축약
const shortenAddress = (address, chars = 4) => {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
};

// ================================================================
// window.SolanaJS 전역 객체 생성 (IIFE 형식)
// ================================================================

if (typeof window !== 'undefined') {
  // SolanaJS 객체 (새로운 패턴)
  window.SolanaJS = {
    // Core 클래스
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL,
    sendAndConfirmTransaction,
    clusterApiUrl,
    
    // 니모닉 관련
    bip39,
    derivePath,
    generateMnemonic,
    validateMnemonic,
    keypairFromMnemonic,
    
    // 유틸리티 함수
    lamportsToSol,
    solToLamports,
    isValidAddress,
    shortenAddress,
    
    // 버전 정보
    version: '1.95.1'
  };
  
  // bs58도 전역으로 노출
  window.bs58 = bs58;
  
  // 하위 호환성을 위한 window.solanaWeb3 별칭
  window.solanaWeb3 = window.SolanaJS;
  
  console.log('[SolanaJS] Bundle loaded (IIFE)', {
    version: window.SolanaJS.version,
    format: 'IIFE',
    global: 'window.SolanaJS'
  });
}

// 모듈로도 export (테스트 환경용)
export {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  clusterApiUrl,
  bip39,
  derivePath,
  keypairFromMnemonic,
  generateMnemonic,
  validateMnemonic,
  lamportsToSol,
  solToLamports,
  isValidAddress,
  shortenAddress
};