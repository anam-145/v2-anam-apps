// Etherscan 미니앱 생명주기 정의

window.App = {
  onLaunch() {
    console.log('Etherscan mini app started');
  },
  
  onShow() {
    console.log('Etherscan mini app shown');
  },
  
  onHide() {
    console.log('Etherscan mini app hidden');
  }
};