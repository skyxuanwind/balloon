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
const generateTableButton = document.getElementById('generate-table-button');
const resultsTableContainer = document.getElementById('results-table-container');

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

// --- "產生結果表格" 按鈕 ---
generateTableButton.addEventListener('click', () => {
    console.log('Generate table button clicked');
    // 向伺服器請求完整的結果數據
    socket.emit('getResultsData'); 
    // 可以加個提示，例如按鈕文字變 '載入中...'
    generateTableButton.textContent = '正在產生表格...';
    generateTableButton.disabled = true;
});

// --- 監聽來自伺服器的完整結果數據 ---
socket.on('resultsData', (allBalloons) => {
    console.log('Received results data:', allBalloons);
    resultsTableContainer.innerHTML = ''; // 清空舊表格

    if (Object.keys(allBalloons).length === 0) {
        resultsTableContainer.innerHTML = '<p>目前沒有任何結果可生成表格。</p>';
        generateTableButton.textContent = '產生結果表格';
        generateTableButton.disabled = false;
        return;
    }

    // 創建表格
    const table = document.createElement('table');
    table.classList.add('results-table'); // 添加 class 以便 CSS 定位

    // 創建表頭
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    const headers = ['供應商 (需求)', '由誰提出', '由誰祝福'];
    headers.forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    });

    // 創建表身
    const tbody = table.createTBody();
    for (const balloonId in allBalloons) {
        const balloonData = allBalloons[balloonId];
        const row = tbody.insertRow();
        
        const cellSupplier = row.insertCell();
        cellSupplier.textContent = balloonData.supplier || '-';

        const cellSubmitter = row.insertCell();
        cellSubmitter.textContent = balloonData.submittedBy || '-';

        const cellHitter = row.insertCell();
        cellHitter.textContent = balloonData.hitBy || '尚未祝福'; // 如果 hitBy 是 null，顯示提示
    }

    // 將表格放入容器
    resultsTableContainer.appendChild(table);

    // 恢復按鈕狀態
    generateTableButton.textContent = '產生結果表格';
    generateTableButton.disabled = false;
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
  resultsTableContainer.innerHTML = ''; // 同步清空表格容器
  generateTableButton.textContent = '產生結果表格'; // 重設按鈕文字
  generateTableButton.disabled = false; // 確保按鈕可用
});
