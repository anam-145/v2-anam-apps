// Universal 미니앱 생명주기 정의

window.App = {
  onLaunch() {
    console.log('Universal mini app started');
  },
  
  onShow() {
    console.log('Universal mini app shown');
  },
  
  onHide() {
    console.log('Universal mini app hidden');
  }
};