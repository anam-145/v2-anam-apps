// Liberia HR Jobs 메인 페이지 스크립트

window.onload = function() {
    console.log('Liberia HR Jobs app loaded');
    
    // 버튼 클릭 이벤트 처리
    document.querySelectorAll('.button').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const url = this.getAttribute('href');
            if (url) {
                window.open(url, '_blank');
            }
        });
    });
};