// Node.js 라이브러리 import
import * as bip39 from "bip39";

// export default가 window.MyBundle이 됨
// (vite.config.js의 name: "MyBundle" 때문)
export default {
  // 전체 bip39 노출
  bip39: bip39,

  // 커스텀 메서드
  wallet: {
    create: () => {
      const mnemonic = bip39.generateMnemonic();
      return {
        mnemonic: mnemonic,
        isValid: bip39.validateMnemonic(mnemonic),
      };
    },
  },

  // 유틸리티 함수들
  utils: {
    generateMnemonic: () => bip39.generateMnemonic(),
    validateMnemonic: (mnemonic) => bip39.validateMnemonic(mnemonic),
    getWordList: () => bip39.wordlists.english,
  },
};

// Vite가 실제로 생성하는 IIFE 번들
// (function() {
//   // 1. 번들링된 bip39 라이브러리
//   var bip39 = (function() {
//     // bip39 라이브러리 전체 코드...
//     return { generateMnemonic, validateMnemonic, wordlists, ... };
//   })();
//
//   // 2. export default 내용이 여기로
//   var MyBundle = {
//     bip39: bip39,
//     wallet: {
//       create: function() {
//         var mnemonic = bip39.generateMnemonic();  // 내부 변수 (은닉됨)
//         return {
//           mnemonic: mnemonic,
//           isValid: bip39.validateMnemonic(mnemonic)
//         };
//       }
//     },
//     utils: {
//       generateMnemonic: function() { return bip39.generateMnemonic(); },
//       validateMnemonic: function(m) { return bip39.validateMnemonic(m); },
//       getWordList: function() { return bip39.wordlists.english; }
//     }
//   };
//
//   // 3. name: "MyBundle"로 window에 할당
//   window.MyBundle = MyBundle;
// })();
