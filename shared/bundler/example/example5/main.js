// Solana 전체 가져오기
import * as solanaWeb3 from "@solana/web3.js";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";

// export default로 MyBundle 생성
export default {
  // 라이브러리
  ...solanaWeb3, // solanaWeb3의 모든 속성 펼치기
  bip39,
  derivePath,

  // Solana 앱에서 사용하는 헬퍼 함수들
  generateMnemonic: () => bip39.generateMnemonic(),

  keypairFromMnemonic: (mnemonic, accountIndex = 0) => {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const path = `m/44'/501'/${accountIndex}'/0'`;
    const derivedSeed = derivePath(path, seed.toString("hex")).key;
    return solanaWeb3.Keypair.fromSeed(derivedSeed);
  },
};
