const socket = io(); // 連接到伺服器

// --- 連接成功後註冊客戶端類型 ---
socket.on('connect', () => {
    console.log('Connected to server, registering as screen');
    socket.emit('registerClient', { type: 'screen' });
});

// 獲取 DOM 元素
const balloonArea = document.getElementById('balloon-area');
const startButton = document.getElementById('start-button');
const resetButton = document.getElementById('reset-button');
const resultsArea = document.getElementById('results-area');

// --- 監聽新氣球事件 ---
socket.on('newBalloons', (newBalloons) => {
  console.log('Received new balloons:', newBalloons);

  newBalloons.forEach(balloon => {
    const balloonElement = document.createElement('div');
    balloonElement.classList.add('balloon'); // 添加 CSS class 好做樣式
    balloonElement.dataset.balloonId = balloon.id; // 將 ID 存在 data attribute

    const numberElement = document.createElement('span');
    numberElement.classList.add('balloon-number');
    numberElement.textContent = balloon.id;

    const supplierElement = document.createElement('span');
    supplierElement.classList.add('balloon-supplier');
    supplierElement.textContent = balloon.supplier;

    balloonElement.appendChild(numberElement);
    balloonElement.appendChild(supplierElement);

    balloonArea.appendChild(balloonElement);
  });
});

// --- "開始給祝福" 按鈕 ---
startButton.addEventListener('click', () => {
  console.log('Start button clicked');
  socket.emit('startGame'); // 通知伺服器開始遊戲
  // 可以考慮在這裡禁用按鈕，避免重複觸發
  startButton.disabled = true;
  startButton.textContent = '祝福進行中...';
});

// --- "重設遊戲" 按鈕 ---
resetButton.addEventListener('click', () => {
  if (confirm('確定要清除所有氣球和結果，重新開始嗎？')) {
    console.log('Reset button clicked');
    socket.emit('resetGame'); // 通知伺服器重設遊戲
  }
});

// --- 監聽氣球被射中事件 ---
socket.on('balloonHit', (data) => {
  const { balloonId, supplier, submitterName, shooterName } = data; // 接收 shooterName
  console.log(`Balloon ${balloonId} hit by ${shooterName}, submitted by ${submitterName}`);

  // 找到螢幕上的氣球元素
  const balloonElement = balloonArea.querySelector(`.balloon[data-balloon-id="${balloonId}"]`);

  if (balloonElement && !balloonElement.classList.contains('hit')) { // 避免重複處理
    balloonElement.classList.add('hit');
    balloonElement.style.opacity = '0.5'; 
    balloonElement.style.backgroundColor = 'grey';
    balloonElement.style.animation = 'none'; // 確保停止飄動

    // 創建結果顯示元素
    const resultElement = document.createElement('div');
    resultElement.classList.add('hit-result');
    // 顯示 ShooterName 要給 SubmitterName 祝福
    resultElement.innerHTML = `<img src="/images/dart.png" alt="dart" class="result-dart-icon"> <strong>${shooterName}</strong> 要給 <strong>${submitterName}</strong> 祝福 (${supplier})`;

    // 將結果添加到結果區域
    resultsArea.appendChild(resultElement);

  } else if (!balloonElement) {
    console.warn(`Balloon element with ID ${balloonId} not found on screen.`);
  }
});

// --- 監聽遊戲重設事件 ---
socket.on('gameReset', () => {
  console.log('Received gameReset signal from server.');
  
  // 清空氣球區域
  balloonArea.innerHTML = '';
  
  // 清空結果區域
  resultsArea.innerHTML = '<h2>祝福結果</h2>'; // 或者 resultsArea.innerHTML = '';
  
  // 重設開始按鈕狀態
  startButton.disabled = false;
  startButton.textContent = '開始給祝福';
  
  alert('遊戲已重設！'); // 給用戶提示
});
