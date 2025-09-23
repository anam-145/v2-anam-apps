// Node.js 라이브러리 import
import * as bip39 from "bip39";

// 방법 1: 전체를 다 노출
window.bip39 = bip39;

// 이제 브라우저에서 bip39의 모든 함수 사용 가능!
// bip39.generateMnemonic()
// bip39.validateMnemonic()
// bip39.mnemonicToSeed()
// 등등...

// 방법 2: 필요 함수 노출
// 브라우저에서 사용할 수 있게 window에 추가
// window.MyBundle = {
//   generateMnemonic: () => {
//     return bip39.generateMnemonic();
//   },
// };

// 사용 const mnemonic = MyBundle.generateMnemonic();
// 전체 노출은 번들 크기 증가
// 다른 라이브러리와 충돌 가능
