// ================================================================
// Universal Bridge Request Handler
// DApp 요청 처리를 전담하는 모듈
// ================================================================

(function() {
  'use strict';

  // 전역 변수 (index.js에서 설정됨)
  let currentWallet = null;
  let adapter = null;
  let CoinConfig = null;

  // Handler 초기화
  function initHandler(wallet, adapterInstance, config) {
    currentWallet = wallet;
    adapter = adapterInstance;
    CoinConfig = config;
  }

  // 지갑 정보 업데이트
  function updateWallet(wallet) {
    currentWallet = wallet;
  }

  // ================================================================
  // Universal Bridge 요청 처리
  // ================================================================

  // Universal Bridge 요청 이벤트 핸들러
  async function handleUniversalRequest(event) {
    console.log("Universal request received:", event.detail);

    const { requestId, payload } = event.detail;

    try {
      const request = JSON.parse(payload);

      // Ethereum RPC 요청인지 확인
      if (request.type === "ethereum_rpc") {
        await handleDAppRequest(requestId, request.method, request.params);
        return;
      }

      // 기존 트랜잭션 요청 처리 (Universal Bridge v1 형식)
      if (request.to && request.amount) {
        // 이 경우 index.js의 handleTransactionRequest로 위임
        if (window.handleTransactionRequest) {
          const transactionEvent = {
            detail: {
              requestId: requestId,
              ...request,
            },
          };
          window.handleTransactionRequest(transactionEvent);
          return;
        }
      }

      // 알 수 없는 요청 타입
      sendUniversalError(requestId, -32000, "Unknown request type");
    } catch (error) {
      console.log("Failed to parse universal request:", error);
      sendUniversalError(requestId, -32700, "Parse error");
    }
  }

  // DApp 요청 처리
  async function handleDAppRequest(requestId, method, params) {
    console.log(`DApp request - method: ${method}, params:`, params);
    console.log(
      `Network: ${CoinConfig.network.networkName} (chainId: ${CoinConfig.network.chainId})`
    );

    // 지갑 정보 확인 (BlockchainService 환경에서 실행될 때를 위해)
    if (!currentWallet) {
      const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
      const walletData = localStorage.getItem(walletKey);
      if (walletData) {
        try {
          currentWallet = JSON.parse(walletData);
          console.log("Wallet info reloaded for DApp request");
        } catch (e) {
          console.log("Failed to load wallet:", e);
          sendDAppError(requestId, -32000, "No wallet found");
          return;
        }
      } else {
        sendDAppError(requestId, -32000, "No wallet found");
        return;
      }
    }

    if (!adapter) {
      adapter = window.getAdapter();
      if (!adapter) {
        sendDAppError(requestId, -32603, "Adapter not initialized");
        return;
      }
    }

    try {
      // EIP-1193 메서드 처리
      switch (method) {
        case "wallet_requestPermissions":
          // 권한 요청 - eth_accounts 권한 반환
          sendDAppResponse(requestId, [{ parentCapability: "eth_accounts" }]);
          break;

        case "eth_requestAccounts":
        case "eth_accounts":
          // 현재 계정 반환
          if (currentWallet && currentWallet.address) {
            sendDAppResponse(requestId, [currentWallet.address]);
          } else {
            // 지갑이 없으면 빈 배열 반환
            sendDAppResponse(requestId, []);
          }
          break;

        case "eth_chainId":
          // 체인 ID 반환 (Sepolia: 11155111 = 0xaa36a7)
          sendDAppResponse(requestId, "0xaa36a7");
          break;

        case "eth_sendTransaction":
          // 트랜잭션 전송
          await handleDAppSendTransaction(requestId, params);
          break;

        case "personal_sign":
          // 메시지 서명
          await handleDAppPersonalSign(requestId, params);
          break;

        case "eth_signTypedData_v4":
          // 구조화된 데이터 서명
          await handleDAppSignTypedData(requestId, params);
          break;

        case "wallet_switchEthereumChain":
          // 네트워크 전환 (현재는 Sepolia만 지원)
          const chainId = params[0]?.chainId;
          if (chainId === "0xaa36a7") {
            sendDAppResponse(requestId, null); // 성공
          } else {
            sendDAppError(requestId, 4902, "Unrecognized chain ID");
          }
          break;

        case "eth_getBalance":
          // 잔액 조회
          const balance = await adapter.getBalance(currentWallet.address);
          // Wei 단위를 16진수로 변환
          const hexBalance = "0x" + BigInt(balance).toString(16);
          sendDAppResponse(requestId, hexBalance);
          break;

        case "eth_blockNumber":
          // 현재 블록 번호
          const blockNumber = await adapter.getBlockNumber();
          const hexBlockNumber = "0x" + blockNumber.toString(16);
          sendDAppResponse(requestId, hexBlockNumber);
          break;

        case "net_version":
          // 네트워크 버전 (Sepolia: 11155111)
          sendDAppResponse(requestId, "11155111");
          break;

        case "wallet_getCapabilities":
          // 지갑 기능 목록 반환 (EIP-5792)
          sendDAppResponse(requestId, {
            "0xaa36a7": {
              // Sepolia chainId
              atomicBatch: {
                supported: false,
              },
              switchChain: {
                supported: true, // 체인 전환 지원
              },
              signTypedDataV4: {
                supported: true, // EIP-712 서명 지원
              },
            },
          });
          break;

        case "wallet_disconnect":
          // 지갑 연결 해제
          handleDAppDisconnect(requestId);
          break;

        default:
          // 미지원 메서드
          sendDAppError(requestId, -32601, `Method not supported: ${method}`);
      }
    } catch (error) {
      console.log("Error handling DApp request:", error);
      sendDAppError(requestId, -32603, error.message);
    }
  }

  // ================================================================
  // DApp 메서드 구현
  // ================================================================

  // DApp 트랜잭션 전송 처리
  async function handleDAppSendTransaction(requestId, params) {
    try {
      const txParams = params[0]; // eth_sendTransaction의 첫 번째 파라미터

      console.log("DApp transaction params:", txParams);

      // ethers가 로드되어 있는지 확인
      if (typeof ethers === 'undefined') {
        throw new Error("ethers.js not loaded");
      }

      // 트랜잭션 파라미터 구성
      const txRequest = {
        from: currentWallet.address,
        to: txParams.to,
        amount: txParams.value ? ethers.utils.formatEther(txParams.value) : "0",
        privateKey: currentWallet.privateKey,
        data: txParams.data || "0x",
      };

      // 가스 설정
      if (txParams.gas) {
        txRequest.gasLimit = parseInt(txParams.gas, 16);
      }
      if (txParams.gasPrice) {
        txRequest.gasPrice = txParams.gasPrice;
      }

      // 트랜잭션 전송
      const result = await adapter.sendTransaction(txRequest);

      // 트랜잭션 해시 반환
      sendDAppResponse(requestId, result.hash);

      // UI 업데이트 콜백 실행 (index.js에서 설정)
      if (window.onDAppTransactionSent) {
        window.onDAppTransactionSent(result.hash);
      }
    } catch (error) {
      console.log("DApp transaction failed:", error);
      sendDAppError(requestId, -32000, error.message);
    }
  }

  // DApp 메시지 서명 처리
  async function handleDAppPersonalSign(requestId, params) {
    try {
      const message = params[0]; // 서명할 메시지
      const address = params[1]; // 주소 (검증용)

      // 주소 확인
      if (address.toLowerCase() !== currentWallet.address.toLowerCase()) {
        sendDAppError(requestId, -32000, "Address mismatch");
        return;
      }

      // ethers가 로드되어 있는지 확인
      if (typeof ethers === 'undefined') {
        throw new Error("ethers.js not loaded");
      }

      // ethers.js를 사용한 서명
      const wallet = new ethers.Wallet(currentWallet.privateKey);
      const signature = await wallet.signMessage(
        ethers.utils.isHexString(message)
          ? ethers.utils.arrayify(message)
          : message
      );

      sendDAppResponse(requestId, signature);
    } catch (error) {
      console.log("DApp signing failed:", error);
      sendDAppError(requestId, -32000, error.message);
    }
  }

  // DApp 구조화된 데이터 서명 처리
  async function handleDAppSignTypedData(requestId, params) {
    try {
      const address = params[0];
      const typedData =
        typeof params[1] === "string" ? JSON.parse(params[1]) : params[1];

      // 주소 확인
      if (address.toLowerCase() !== currentWallet.address.toLowerCase()) {
        sendDAppError(requestId, -32000, "Address mismatch");
        return;
      }

      // ethers가 로드되어 있는지 확인
      if (typeof ethers === 'undefined') {
        throw new Error("ethers.js not loaded");
      }

      // ethers.js를 사용한 EIP-712 서명
      const wallet = new ethers.Wallet(currentWallet.privateKey);
      const signature = await wallet._signTypedData(
        typedData.domain,
        typedData.types,
        typedData.message
      );

      sendDAppResponse(requestId, signature);
    } catch (error) {
      console.log("DApp typed data signing failed:", error);
      sendDAppError(requestId, -32000, error.message);
    }
  }

  // DApp disconnect 처리
  function handleDAppDisconnect(requestId) {
    console.log("DApp disconnect requested");

    // 성공 응답 보내기 - null 반환 (대부분의 라이브러리가 기대하는 값)
    sendDAppResponse(requestId, null);

    // 참고: disconnect 이벤트는 BrowserWebView의 provider.disconnect() 메서드가 호출될 때
    // 직접 발생합니다. Ethereum 미니앱에서는 응답만 보내면 됩니다.
  }

  // ================================================================
  // 응답 전송 함수
  // ================================================================

  // Universal Bridge 응답 전송
  function sendDAppResponse(requestId, result) {
    const response = {
      jsonrpc: "2.0",
      id: requestId,
      result: result,
    };

    if (window.anam && window.anam.sendUniversalResponse) {
      window.anam.sendUniversalResponse(requestId, JSON.stringify(response));
      console.log("Universal response sent:", response);
    } else {
      console.log("Universal Bridge not available for response");
    }
  }

  // Universal Bridge 에러 응답 전송
  function sendDAppError(requestId, code, message) {
    const errorResponse = {
      jsonrpc: "2.0",
      id: requestId,
      error: {
        code: code,
        message: message,
      },
    };

    if (window.anam && window.anam.sendUniversalResponse) {
      window.anam.sendUniversalResponse(requestId, JSON.stringify(errorResponse));
      console.log("Universal error sent:", errorResponse);
    }
  }

  // Universal Bridge 에러 응답 전송 (호환성)
  function sendUniversalError(requestId, code, message) {
    sendDAppError(requestId, code, message);
  }

  // ================================================================
  // 모듈 내보내기
  // ================================================================

  window.BridgeHandler = {
    initHandler,
    updateWallet,
    handleUniversalRequest
  };

  console.log('[BridgeHandler] Module loaded');
})();