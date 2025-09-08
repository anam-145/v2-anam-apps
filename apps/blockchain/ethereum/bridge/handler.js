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
    
    console.log("[BridgeHandler] Initialized with:", {
      hasWallet: !!wallet,
      walletAddress: wallet?.address,
      hasPrivateKey: !!wallet?.privateKey,
      hasKeystore: wallet?.hasKeystore,
      hasAdapter: !!adapterInstance,
      network: config?.network?.networkName
    });
  }

  // 지갑 정보 업데이트
  function updateWallet(wallet) {
    const oldHasKey = !!currentWallet?.privateKey;
    currentWallet = wallet;
    const newHasKey = !!wallet?.privateKey;
    
    console.log("[BridgeHandler] Wallet updated:", {
      address: wallet?.address,
      privateKeyStatus: oldHasKey ? "was present" : "was missing",
      privateKeyNow: newHasKey ? "is present" : "is missing",
      hasKeystore: wallet?.hasKeystore
    });
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

  // ================================================================
  // DApp 요청 라우터 - 모든 DApp 요청이 여기서 분기됨
  // ================================================================
  async function handleDAppRequest(requestId, method, params) {
    // ====== 요청 수신 로그 ======
    console.log(`🌐 [DApp Router] New request received:`, {
      requestId: requestId,
      method: method,
      params: params,
      timestamp: new Date().toISOString()
    });
    console.log(
      `⚙️ [DApp Router] Current network: ${CoinConfig.network.networkName} (chainId: ${CoinConfig.network.chainId})`
    );

    // 지갑 정보 확인 (BlockchainService 환경에서 실행될 때를 위해)
    if (!currentWallet) {
      currentWallet = WalletStorage.get();
      if (currentWallet) {
        console.log("[DApp Router] Wallet info reloaded for DApp request");
        
        // BlockchainService 환경에서는 sessionStorage에서 복호화된 데이터 확인
        const sessionData = sessionStorage.getItem('eth_wallet_session');
        if (sessionData) {
          try {
            const parsed = JSON.parse(sessionData);
            if (parsed.privateKey && !currentWallet.privateKey) {
              currentWallet.privateKey = parsed.privateKey;
              console.log("[DApp Router] Private key loaded from session");
            }
          } catch (e) {
            console.log("[DApp Router] Session parse error:", e);
          }
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
          // 체인 ID 반환 (Mainnet: 1 = 0x1)
          sendDAppResponse(requestId, "0x1");
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
          // 네트워크 전환 (현재는 메인넷만 지원)
          const chainId = params[0]?.chainId;
          if (chainId === "0x1") {
            sendDAppResponse(requestId, null); // 성공 (이미 메인넷)
          } else {
            sendDAppError(requestId, 4902, "Unrecognized chain ID. Only Mainnet is supported");
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
          // 네트워크 버전 (Mainnet: 1)
          sendDAppResponse(requestId, "1");
          break;

        case "wallet_getCapabilities":
          // 지갑 기능 목록 반환 (EIP-5792)
          sendDAppResponse(requestId, {
            "0x1": {
              // Mainnet
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
          console.log(`[DApp Handler] Unsupported method requested: ${method}`);
          console.log(`[DApp Handler] Consider implementing this method if needed by DApps`);
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

  // ================================================================
  // DApp 트랜잭션 전송 처리
  // 유니스왑 스왑 등 DApp 트랜잭션이 여기서 처리됨
  // VERSION: 2.1 - EIP-1559 Support Added
  // ================================================================
  async function handleDAppSendTransaction(requestId, params) {
    console.log("🔥 [VERSION 2.1] handleDAppSendTransaction called - EIP-1559 SUPPORTED");
    
    try {
      // ====== STEP 1: 파라미터 추출 ======
      const txParams = params[0]; // eth_sendTransaction의 첫 번째 파라미터
      console.log("📝 [STEP 1] DApp transaction params received:", txParams);

      // ====== STEP 2: ethers.js 확인 ======
      // ethers가 없으면 트랜잭션 서명 불가
      if (typeof ethers === 'undefined') {
        console.error("❌ [STEP 2] ethers.js not loaded - cannot sign transaction");
        throw new Error("ethers.js not loaded");
      }
      console.log("✅ [STEP 2] ethers.js available");

      // ====== STEP 3: Private Key 가져오기 ======
      console.log("🔑 [STEP 3] Loading private key...");
      const privateKey = await WalletStorage.getPrivateKeySecure();
      if (!privateKey) {
        console.error("❌ [STEP 3] Failed to load private key");
        throw new Error("Failed to access wallet keys");
      }
      console.log("✅ [STEP 3] Private key loaded");

      // ====== STEP 4: Value(ETH 금액) 파싱 ======
      // DApp은 value를 hex string으로 보냄 (예: "0x2386f26fc10000" = 0.01 ETH)
      let amountInEther = "0";
      if (txParams.value) {
        try {
          console.log("💰 [STEP 4] Parsing value:", txParams.value);
          const valueBN = ethers.BigNumber.from(txParams.value);
          amountInEther = ethers.utils.formatEther(valueBN);
          console.log("✅ [STEP 4] Value parsed:", amountInEther, "ETH");
        } catch (e) {
          console.error("⚠️ [STEP 4] Failed to parse value, defaulting to 0:", e.message);
          amountInEther = "0";
        }
      } else {
        console.log("ℹ️ [STEP 4] No value (pure contract call)");
      }

      // ====== STEP 5: 트랜잭션 파라미터 구성 ======
      const txRequest = {
        from: currentWallet.address,
        to: txParams.to,
        amount: amountInEther,
        privateKey: privateKey,
        data: txParams.data || "0x", // 컨트랙트 호출 데이터
      };

      // ====== STEP 6: 가스 설정 ======
      // EIP-1559 트랜잭션 지원 (maxFeePerGas, maxPriorityFeePerGas)
      if (txParams.gas) {
        txRequest.gasLimit = parseInt(txParams.gas, 16);
        console.log("⛽ [STEP 6] Gas limit set:", txRequest.gasLimit);
      }
      
      // EIP-1559 스타일 (유니스왑이 사용)
      if (txParams.maxFeePerGas) {
        txRequest.maxFeePerGas = txParams.maxFeePerGas;
        console.log("⛽ [STEP 6] Max fee per gas (EIP-1559):", txParams.maxFeePerGas);
      }
      if (txParams.maxPriorityFeePerGas) {
        txRequest.maxPriorityFeePerGas = txParams.maxPriorityFeePerGas;
        console.log("⛽ [STEP 6] Max priority fee per gas (EIP-1559):", txParams.maxPriorityFeePerGas);
      }
      
      // Legacy 스타일 (gasPrice만 있는 경우)
      if (txParams.gasPrice && !txParams.maxFeePerGas) {
        txRequest.gasPrice = txParams.gasPrice;
        console.log("⛽ [STEP 6] Gas price (Legacy):", txRequest.gasPrice);
      }

      // ====== STEP 7: 최종 확인 로그 ======
      console.log("📋 [STEP 7] Final transaction params:", {
        from: txRequest.from,
        to: txRequest.to,
        amount: txRequest.amount + " ETH",
        hasPrivateKey: !!txRequest.privateKey,
        dataLength: txRequest.data ? txRequest.data.length : 0,
        gasLimit: txRequest.gasLimit || "default",
        gasPrice: txRequest.gasPrice || "not set",
        maxFeePerGas: txRequest.maxFeePerGas || "not set",
        maxPriorityFeePerGas: txRequest.maxPriorityFeePerGas || "not set",
        isEIP1559: !!txRequest.maxFeePerGas
      });
      
      // ====== STEP 8: 트랜잭션 서명 및 전송 ======
      console.log("🚀 [STEP 8] Signing and broadcasting transaction...");
      const result = await adapter.sendTransaction(txRequest);
      
      if (!result || !result.hash) {
        console.error("❌ [STEP 8] Transaction failed - no hash returned");
        throw new Error("Transaction failed - no hash returned");
      }
      
      console.log("✅ [STEP 8] Transaction broadcast successfully!", {
        hash: result.hash,
        timestamp: new Date().toISOString()
      });

      // ====== STEP 9: DApp에 응답 전송 ======
      sendDAppResponse(requestId, result.hash);
      console.log("✅ [STEP 9] Response sent to DApp with tx hash:", result.hash);

      // ====== STEP 10: UI 업데이트 (선택사항) ======
      if (window.onDAppTransactionSent) {
        console.log("📱 [STEP 10] Updating UI with transaction");
        window.onDAppTransactionSent(result.hash);
      }
    } catch (error) {
      // ====== 에러 처리 ======
      console.error("❌ [ERROR] DApp transaction failed at some step");
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // DApp에 에러 응답 전송
      sendDAppError(requestId, -32000, error.message);
    }
  }

  // ================================================================
  // DApp 메시지 서명 처리 (personal_sign)
  // 로그인, 인증 등에 사용됨
  // ================================================================
  async function handleDAppPersonalSign(requestId, params) {
    try {
      // ====== STEP 1: 파라미터 추출 ======
      const message = params[0]; // 서명할 메시지
      const address = params[1]; // 주소 (검증용)
      console.log("✍️ [personal_sign] Request received:", {
        messageLength: message?.length,
        address: address
      });

      // ====== STEP 2: 주소 검증 ======
      if (address.toLowerCase() !== currentWallet.address.toLowerCase()) {
        console.error("❌ [personal_sign] Address mismatch:", {
          requested: address,
          current: currentWallet.address
        });
        sendDAppError(requestId, -32000, "Address mismatch");
        return;
      }
      console.log("✅ [personal_sign] Address verified");

      // ====== STEP 3: ethers.js 확인 ======
      if (typeof ethers === 'undefined') {
        console.error("❌ [personal_sign] ethers.js not loaded");
        throw new Error("ethers.js not loaded");
      }

      // ====== STEP 4: Private Key 가져오기 ======
      console.log("🔑 [personal_sign] Loading private key...");
      const privateKey = await WalletStorage.getPrivateKeySecure();
      if (!privateKey) {
        console.error("❌ [personal_sign] Failed to get private key");
        throw new Error("Failed to get private key for signing");
      }
      console.log("✅ [personal_sign] Private key loaded");

      // ====== STEP 5: 메시지 서명 ======
      console.log("✍️ [personal_sign] Signing message...");
      const wallet = new ethers.Wallet(privateKey);
      const signature = await wallet.signMessage(
        ethers.utils.isHexString(message)
          ? ethers.utils.arrayify(message)
          : message
      );
      console.log("✅ [personal_sign] Message signed successfully");

      // ====== STEP 6: 응답 전송 ======
      sendDAppResponse(requestId, signature);
      console.log("✅ [personal_sign] Signature sent to DApp");
      
    } catch (error) {
      console.error("❌ [personal_sign] Failed:", error);
      sendDAppError(requestId, -32000, error.message);
    }
  }

  // ================================================================
  // DApp 구조화된 데이터 서명 처리 (EIP-712)
  // NFT 거래, DEX 주문 등 복잡한 데이터 서명에 사용
  // ================================================================
  async function handleDAppSignTypedData(requestId, params) {
    try {
      // ====== STEP 1: 파라미터 추출 ======
      const address = params[0];
      const typedData =
        typeof params[1] === "string" ? JSON.parse(params[1]) : params[1];
      
      console.log("📝 [signTypedData_v4] Request received:", {
        address: address,
        domain: typedData?.domain?.name,
        primaryType: typedData?.primaryType
      });

      // ====== STEP 2: 주소 검증 ======
      if (address.toLowerCase() !== currentWallet.address.toLowerCase()) {
        console.error("❌ [signTypedData_v4] Address mismatch:", {
          requested: address,
          current: currentWallet.address
        });
        sendDAppError(requestId, -32000, "Address mismatch");
        return;
      }
      console.log("✅ [signTypedData_v4] Address verified");

      // ====== STEP 3: ethers.js 확인 ======
      if (typeof ethers === 'undefined') {
        console.error("❌ [signTypedData_v4] ethers.js not loaded");
        throw new Error("ethers.js not loaded");
      }

      // ====== STEP 4: Private Key 가져오기 ======
      console.log("🔑 [signTypedData_v4] Loading private key...");
      const privateKey = await WalletStorage.getPrivateKeySecure();
      if (!privateKey) {
        console.error("❌ [signTypedData_v4] Failed to get private key");
        throw new Error("Failed to get private key for signing");
      }
      console.log("✅ [signTypedData_v4] Private key loaded");

      // ====== STEP 5: EIP-712 구조화된 데이터 서명 ======
      console.log("✍️ [signTypedData_v4] Signing typed data...");
      const wallet = new ethers.Wallet(privateKey);
      const signature = await wallet._signTypedData(
        typedData.domain,
        typedData.types,
        typedData.message
      );
      console.log("✅ [signTypedData_v4] Typed data signed successfully");

      // ====== STEP 6: 응답 전송 ======
      sendDAppResponse(requestId, signature);
      console.log("✅ [signTypedData_v4] Signature sent to DApp");
      
    } catch (error) {
      console.error("❌ [signTypedData_v4] Failed:", error);
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