// Yelp 미니앱 생명주기 정의

window.App = {
  onLaunch() {
    console.log('Yelp mini app started');
  },
  
  onShow() {
    console.log('Yelp mini app shown');
  },
  
  onHide() {
    console.log('Yelp mini app hidden');
  }
};