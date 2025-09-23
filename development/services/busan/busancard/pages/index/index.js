// 부산카드 메인 페이지 로직
console.log("Busan Card page loaded");

// 사용내역 로드
async function loadTransactionHistory() {
  try {
    // 사용내역 표시
    const historyList = document.getElementById("history-list");

    // 예시 사용내역 데이터 (USD 기준)
    const EXCHANGE_RATE = 1450; // 1 USD = 1450 KRW
    const transactions = [
      {
        date: "2024-01-16",
        time: "14:32",
        merchant: "GS25 Haeundae Branch",
        amountUSD: -3.1,
        amountKRW: -4500,
        type: "payment",
      },
      {
        date: "2024-01-16",
        time: "10:15",
        merchant: "Starbucks Marine City",
        amountUSD: -4.0,
        amountKRW: -5800,
        type: "payment",
      },
      {
        date: "2024-01-15",
        time: "09:00",
        merchant: "Charge",
        amountUSD: 34.48,
        amountKRW: 50000,
        type: "charge",
      },
      {
        date: "2024-01-14",
        time: "18:20",
        merchant: "Daiso Busan University Branch",
        amountUSD: -5.52,
        amountKRW: -8000,
        type: "payment",
      },
    ];

    // 날짜별로 그룹화
    const groupedTransactions = transactions.reduce((groups, transaction) => {
      const date = transaction.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(transaction);
      return groups;
    }, {});

    // HTML 생성
    let html = "";
    for (const [date, dayTransactions] of Object.entries(groupedTransactions)) {
      const dateObj = new Date(date);
      const formattedDate = `${
        dateObj.getMonth() + 1
      }/${dateObj.getDate()}`;

      html += `<div class="history-date">${formattedDate}</div>`;

      dayTransactions.forEach((transaction) => {
        const amountClass =
          transaction.amountUSD > 0 ? "amount-plus" : "amount-minus";
        const formattedUSD =
          transaction.amountUSD > 0
            ? `+${Math.abs(transaction.amountUSD).toFixed(2)}`
            : `-${Math.abs(transaction.amountUSD).toFixed(2)}`;
        const formattedKRW =
          transaction.amountKRW > 0
            ? `+${Math.abs(transaction.amountKRW).toLocaleString()}`
            : `-${Math.abs(transaction.amountKRW).toLocaleString()}`;

        html += `
          <div class="history-item">
            <div class="history-details">
              <div class="history-merchant">${transaction.merchant}</div>
              <div class="history-time">${transaction.time}</div>
            </div>
            <div class="history-amount">
              <div class="amount-main ${amountClass}">$${formattedUSD}</div>
              <div class="amount-sub">₩${formattedKRW}</div>
            </div>
          </div>
        `;
      });
    }

    historyList.innerHTML = html;
  } catch (error) {
    console.error("Failed to load transaction history:", error);
    const historyList = document.getElementById("history-list");
    historyList.innerHTML = `
      <p style="text-align: center; color: #e74c3c;">Unable to load transaction history.</p>
    `;
  }
}

// 충전 페이지로 이동
function navigateToCharge() {
  window.location.href = "../charge/charge.html";
}

// 사용 페이지로 이동
function navigateToUse() {
  window.location.href = "../use/use.html";
}

// 페이지 로드 시 사용내역 로드
window.addEventListener("DOMContentLoaded", () => {
  loadTransactionHistory();
});
