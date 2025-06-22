fetch('header.html')
.then(response => response.text())
.then(data => {

    var path = window.location.pathname;

    document.getElementById('header-placeholder').innerHTML = data;

    if (path.includes('product.html')) {
        document.getElementById('nav-product').classList.add('active');
    } else {
        document.getElementById('nav-home').classList.add('active');
    }
    
    // Trigger dashboard initialization after header is loaded
    if (typeof initializeDashboard === 'function') {
        initializeDashboard();
        initializeSellerDashboard();
    }
});
