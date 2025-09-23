import * as bip39 from "bip39";

// 브라우저 전용 간단한 구조
export default {
  // 니모닉 생성
  createWallet: () => {
    const mnemonic = bip39.generateMnemonic();
    return {
      mnemonic,
      wordCount: mnemonic.split(' ').length
    };
  },
  
  // 검증
  validate: (mnemonic) => bip39.validateMnemonic(mnemonic)
};