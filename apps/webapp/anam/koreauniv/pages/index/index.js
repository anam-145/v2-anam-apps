// 정부24 메인 페이지 로직
console.log("Government24 index page loaded");

// Check login status
let isLoggedIn = false;

// 로그인 핸들러 - 바로 payment 페이지로 이동
function handleLogin() {
  console.log("Login button clicked");
  
  // 로그인 상태로 설정
  isLoggedIn = true;
  
  // 바로 payment 페이지로 이동
  if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo("pages/payment/payment");
  } else {
    // 개발 환경
    window.location.href = "../payment/payment.html";
  }
}


// 서비스 클릭 핸들러
function handleServiceClick(serviceName) {
  console.log(`Service clicked: ${serviceName}`);

  // Check login status
  if (!isLoggedIn) {
    // 로그인하지 않았으면 아무 반응 없음
    return;
  }

  // 주민등록등본 클릭 시 결제 페이지로 이동
  if (serviceName === "Resident Registration Transcript") {
    window.anam.navigateTo("pages/payment/payment");
  } else {
    // 다른 서비스들도 아무 반응 없음
    return;
  }
}
