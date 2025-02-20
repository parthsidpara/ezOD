document.getElementById('generateBtn').addEventListener('click', () => {
    const btn = document.getElementById('generateBtn');
    const loader = document.querySelector('.loader');
    const statusText = document.getElementById('statusText');
    
    btn.disabled = true;
    loader.style.display = 'block';
    statusText.textContent = 'Processing attendance data...';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab.url.includes('https://vtopcc.vit.ac.in/vtop/content')) {
            chrome.tabs.sendMessage(tab.id, { action: 'generateODSummary' }, (response) => {
                loader.style.display = 'none';
                btn.disabled = false;
                
                if (chrome.runtime.lastError) {
                    statusText.textContent = 'Error: ' + chrome.runtime.lastError.message;
                } else if (response?.success) {
                    statusText.textContent = 'OD summary generated!';
                    setTimeout(() => window.close(), 1000); 
                } else {
                    statusText.textContent = 'Failed: ' + (response?.error || 'Unknown error');
                }
            });
        } else {
            loader.style.display = 'none';
            btn.disabled = false;
            statusText.textContent = 'Please navigate to VTOP Content page first.';
        }
    });
});