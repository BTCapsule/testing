

// Common function to retrieve all cookies
function getCookies() {
    const cookies = {};
    document.cookie.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        cookies[name] = value;
    });
    return cookies;
}

// In cookies.js
let previousSecretFileCount = 0;

function checkSessionAuth() {
	
	    if (window.location.pathname.includes('pin')) {
        return;
    }
    const cookies = getCookies();
    const sessionAuth = cookies['session_auth'];
    const userNumber = parseInt(cookies['user_number'] || '0');
        // Keep existing session auth check
    if (!sessionAuth || sessionAuth !== 'true') {
       window.location.replace('/pin');
		return;
    }
	
	
	
    // Get current secret files count from cookie
    const currentFileCount = parseInt(cookies['secret_count'] || '0');
    
    // Check for new users (one at a time)
    if (currentFileCount > userNumber) {
        const nextUserNumber = userNumber + 1;
        showNewUserMessage(`user${nextUserNumber}`);
    }


}

function showNewUserMessage(userNumber) {
    const message = document.createElement('div');
    message.className = 'new-user-message';
    message.setAttribute('data-user-number', userNumber.replace('user', ''));
    message.innerHTML = `
        <span>New user ${userNumber} added</span>
        <button onclick="dismissMessage(this.parentElement)">Dismiss</button>
    `;
    message.addEventListener('click', (event) => {
        if (event.target.tagName !== 'BUTTON') {
            promptRemoveUser(userNumber, message);
        }
    });
    document.body.appendChild(message);
    // Trigger reflow to ensure transition works
    message.offsetHeight;
    message.classList.add('show');
}

function dismissMessage(element) {
    const userNum = element.getAttribute('data-user-number');
    document.cookie = `user_number=${userNum}`;
    element.classList.remove('show');
    element.classList.add('hide');
    // Remove element after fade completes
    setTimeout(() => {
        element.remove();
    }, 500); // Match this to your CSS transition duration
}

function promptRemoveUser(userNumber, messageElement) {
    const remove = confirm(`Remove ${userNumber}?`);
    if (remove) {
        fetch('/remove-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // Send the actual user number to remove
            body: JSON.stringify({ 
                userNumber: parseInt(userNumber.replace('user', '')) 
            }),
            credentials: 'include'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                messageElement.remove();
                // Update cookies to reflect new state
                document.cookie = `secret_count=${data.newCount}`;
                // Force a session check to update notifications
                checkSessionAuth();
            }
        });
    }
}

// Function for index.html
function checkAccess() {
    const cookies = getCookies();
    const secretCookie = cookies['secret'];
    const encryptCookie = cookies['encrypt'];
    if (secretCookie && encryptCookie) {
        window.location.href = '/';
    } else {
        setTimeout(checkAccess, 5000);
    }
}

let ws;

function connectWebSocket() {
    ws = new WebSocket('wss://' + window.location.host);
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'newDevicePrompt') {
            handleNewDevicePrompt(message.ip);
        } else if (message.type === 'deviceResponseUpdate') {
            handleDeviceResponseUpdate(message.ip, message.allow);
        } else if (message.type === 'newUserCreated') {
            showNewUserMessage(message.ip);
        }
    };
    ws.onclose = () => {
        setTimeout(connectWebSocket, 1000);
    };
}

function handleNewDevicePrompt(ip) {
    const existingPrompt = document.querySelector(`.new-user-message[data-ip="${ip}"]`);
    if (existingPrompt) {
        existingPrompt.remove();
    }
    
    const promptElement = document.createElement('div');
    promptElement.className = 'new-user-message';
    promptElement.setAttribute('data-ip', ip);
    promptElement.innerHTML = `
        <span>Allow user with IP ${ip} to access?</span>
        <button onclick="handleDeviceResponse('${ip}', true)">Allow</button>
        <button onclick="handleDeviceResponse('${ip}', false)">Deny</button>
    `;
    document.body.appendChild(promptElement);
}

function handleDeviceResponse(ip, allow) {
    ws.send(JSON.stringify({ type: 'deviceResponse', ip, allow }));
}

function handleDeviceResponseUpdate(ip, allow, isNewUser) {
    const existingPrompt = document.querySelector(`.new-user-message[data-ip="${ip}"]`);
    if (existingPrompt) {
        existingPrompt.remove();
    }

    const message = document.createElement('div');
    message.className = 'new-user-message';
    message.setAttribute('data-ip', ip);
    
    if (allow) {
        message.innerHTML = `
            <span>User [${ip}] was accepted</span>
            <button onclick="dismissMessage(this.parentElement)">Dismiss</button>
        `;
        document.body.appendChild(message);
        setTimeout(() => {
            message.remove();
        }, 3000);
    } else if (!allow) {
        message.innerHTML = `
            <span>User [${ip}] was denied</span>
            <button onclick="dismissMessage(this.parentElement)">Dismiss</button>
        `;
        document.body.appendChild(message);
    }
}



document.addEventListener('DOMContentLoaded', function() {
    connectWebSocket();
    if (window.location.pathname.includes('main.html')) {
        checkAccess();
    } else {
        checkSessionAuth();
        setInterval(checkSessionAuth, 5000); // Changed to check every 5 seconds
    }
}, false);
