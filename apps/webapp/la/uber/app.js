// Uber 미니앱 생명주기 정의

window.App = {
  onLaunch() {
    console.log('Uber mini app started');
  },
  
  onShow() {
    console.log('Uber mini app shown');
  },
  
  onHide() {
    console.log('Uber mini app hidden');
  }
};