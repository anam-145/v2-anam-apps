// Stellar SDK Bundle - v11 Named Import 방식
import {
  Horizon,
  SorobanRpc,
  Keypair,
  Asset,
  Operation,
  TransactionBuilder,
  Networks,
  Memo,
  StrKey,
  Claimant,
  Account,
  Transaction,
  FeeBumpTransaction,
  xdr,
  BASE_FEE
} from 'stellar-sdk';
import StellarHDWallet from 'stellar-hd-wallet';

// v11 구조에 맞춘 번들 객체
const stellarBundle = {
  // 네임스페이스
  Horizon,
  SorobanRpc,

  // v10 호환성을 위한 Server 직접 노출
  Server: Horizon.Server,

  // 핵심 클래스들
  Keypair,
  Asset,
  Operation,
  TransactionBuilder,
  Networks: Networks || {},
  Memo,
  StrKey,
  Claimant,
  Account,
  Transaction,
  FeeBumpTransaction,

  // XDR과 상수
  xdr,
  BASE_FEE,

  // HD Wallet
  StellarHDWallet
};

// 전역 객체 설정
if (typeof window !== 'undefined') {
  window.stellarSDK = stellarBundle;
  // __stellarBundle 백업은 더 이상 필요 없음 (문제 해결됨)
}

console.log('[Stellar Bundle] SDK loaded successfully', {
  hasServer: !!stellarBundle.Server,
  hasHorizon: !!stellarBundle.Horizon,
  hasNetworks: !!stellarBundle.Networks,
  hasKeypair: !!stellarBundle.Keypair
});

// Default export로 변경 (Vite 라이브러리 모드 최적화)
export default stellarBundle;