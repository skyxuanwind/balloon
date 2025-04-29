const socket = io(); // 連接到伺服器

// --- 連接成功後註冊客戶端類型 ---
socket.on('connect', () => {
    console.log('Connected to server, registering as mobile');
    socket.emit('registerClient', { type: 'mobile' });
});

// 獲取 DOM 元素
const initialForm = document.getElementById('initial-form');
const waitingScreen = document.getElementById('waiting-screen');
const dartScreen = document.getElementById('dart-screen');
const resultMessage = document.getElementById('result-message');

const nameInput = document.getElementById('name');
const supplier1Input = document.getElementById('supplier1');
const supplier2Input = document.getElementById('supplier2');
const supplier3Input = document.getElementById('supplier3');
const submitButton = document.getElementById('submit-button');

const targetNumber1Input = document.getElementById('target-number1');
const targetNumber2Input = document.getElementById('target-number2');
const shootButton = document.getElementById('shoot-button');

// --- 階段 1: 提交資訊 ---
submitButton.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const supplier1 = supplier1Input.value.trim();
    const supplier2 = supplier2Input.value.trim();
    const supplier3 = supplier3Input.value.trim();

    if (!name || !supplier1 || !supplier2 || !supplier3) {
        alert('請填寫所有欄位！');
        return;
    }

    // 發送資料到伺服器
    socket.emit('submitInfo', { name, supplier1, supplier2, supplier3 });

    // 切換到等待畫面
    initialForm.style.display = 'none';
    waitingScreen.style.display = 'block';

    // 清空輸入框 (可選)
    nameInput.value = '';
    supplier1Input.value = '';
    supplier2Input.value = '';
    supplier3Input.value = '';
});


// --- 階段 2: 等待開始 (伺服器觸發) ---
// 監聽來自伺服器的 'startGame' 事件
socket.on('startGame', () => {
  console.log('Received startGame signal from server.');
  // 確保是在等待狀態才切換
  if (waitingScreen.style.display === 'block') { 
    waitingScreen.style.display = 'none';
    dartScreen.style.display = 'block';
  }
});


// --- 階段 3: 射出祝福 ---
shootButton.addEventListener('click', () => {
    const targetNumber1Str = targetNumber1Input.value.trim();
    const targetNumber2Str = targetNumber2Input.value.trim();

    if (!targetNumber1Str || !targetNumber2Str) {
        alert('請輸入兩個氣球號碼！');
        return;
    }

    const targetBalloonId1 = parseInt(targetNumber1Str, 10);
    const targetBalloonId2 = parseInt(targetNumber2Str, 10);

    if (isNaN(targetBalloonId1) || isNaN(targetBalloonId2)) {
        alert('請輸入有效的數字號碼！');
        return;
    }
    
    if (targetBalloonId1 === targetBalloonId2) {
        alert('請選擇兩個不同的氣球號碼！');
        return;
    }

    console.log(`Shooting at balloon IDs: ${targetBalloonId1} and ${targetBalloonId2}`);
    socket.emit('shootDart', { targetBalloonId1, targetBalloonId2 });

    // 禁用輸入和按鈕
    targetNumber1Input.disabled = true;
    targetNumber2Input.disabled = true;
    shootButton.disabled = true;
    shootButton.textContent = '發送中...';
    resultMessage.textContent = '';
    resultMessage.style.display = 'none';
});


// --- 階段 4: 顯示結果 ---
// 監聽來自伺服器的結果事件
socket.on('shotResult', (results) => {
  console.log('Shot results received:', results); // Log received data

  // **Defensive check: Ensure results is an array**
  if (!Array.isArray(results)) {
    console.error('Received non-array shotResult:', results);
    // Display a generic error message or handle appropriately
    resultMessage.innerHTML = '收到意外的伺服器回應。';
    resultMessage.style.display = 'block';
    resultMessage.className = 'error';
    dartScreen.style.display = 'none'; // Hide dart screen

    // Allow retry? Maybe reset UI to dart screen after delay
    setTimeout(() => {
        resultMessage.style.display = 'none';
        // Re-enable controls if needed
        targetNumber1Input.disabled = false;
        targetNumber2Input.disabled = false;
        shootButton.disabled = false;
        shootButton.textContent = '再次射出祝福';
        dartScreen.style.display = 'block';
    }, 5000);
    return; // Stop further processing
  }

  // 隱藏射擊畫面
  dartScreen.style.display = 'none';
  
  let finalMessage = '';
  let allowRetry = false;

  results.forEach(result => {
    finalMessage += `祝福 ${result.shot}: ${result.message}<br>`;
    if (!result.success) {
        allowRetry = true;
    }
  });

  // 顯示結果訊息
  resultMessage.innerHTML = finalMessage; // 使用 innerHTML 以支援 <br>
  resultMessage.style.display = 'block';
  // 樣式可以基於是否所有都成功
  resultMessage.className = results.every(r => r.success) ? 'success' : 'error'; 

  // 如果至少有一個失敗，允許重試
  if (allowRetry) {
    targetNumber1Input.disabled = false;
    targetNumber2Input.disabled = false;
    shootButton.disabled = false;
    shootButton.textContent = '再次射出祝福'; // 改按鈕文字
    
    // 清空輸入框
    targetNumber1Input.value = '';
    targetNumber2Input.value = '';

    // 延遲後返回射擊畫面
    setTimeout(() => {
        resultMessage.style.display = 'none';
        dartScreen.style.display = 'block'; 
    }, 5000); // 顯示訊息 5 秒
  } else {
      // 全部成功後可以保持禁用狀態，或顯示完成畫面
      resultMessage.innerHTML += "全部成功！🎉"; 
      // 可能需要一個按鈕返回初始畫面或等待重設
  }
});

// --- 監聽遊戲重設事件 ---
socket.on('gameReset', () => {
    console.log('Received gameReset signal. Resetting mobile UI.');

    // 隱藏所有後續畫面
    waitingScreen.style.display = 'none';
    dartScreen.style.display = 'none';
    resultMessage.style.display = 'none';

    // 顯示初始表單
    initialForm.style.display = 'block';

    // 重設表單內元素狀態 (如果之前有禁用)
    nameInput.disabled = false;
    supplier1Input.disabled = false;
    supplier2Input.disabled = false;
    supplier3Input.disabled = false;
    submitButton.disabled = false;
    targetNumber1Input.value = '';
    targetNumber1Input.disabled = false;
    targetNumber2Input.value = '';
    targetNumber2Input.disabled = false;
    shootButton.disabled = false;
    shootButton.textContent = '射出祝福';

    // 重新註冊一次客戶端類型 (因為伺服器清空了)
    // 注意：這會在伺服器重啟或用戶刷新頁面時自動發生，但為了立即響應 reset，這裡也加一次
    socket.emit('registerClient', { type: 'mobile' });
});
