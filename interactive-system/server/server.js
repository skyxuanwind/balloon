const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// 儲存用戶和氣球數據的地方 (暫時用記憶體)
let users = {}; // { socketId: { name: '...', suppliers: ['...', '...'] }, ... }
let balloons = {}; // { balloonId: { supplier: '...', name: '...', hitBy: null | string }, ... }
let nextBalloonId = 1;

// 新增：用來記錄 socket ID 對應的客戶端類型 ('mobile' or 'screen')
let clientTypes = {};

// 設定靜態文件目錄 (存放 HTML, CSS, JS)
// Assuming Render runs the start command with the project root as the CWD
// const publicDirectoryPath = path.join(__dirname, '../public'); // Previous way
const publicDirectoryPath = path.resolve('public'); // Resolve relative to CWD
console.log(`[Server Path] Serving static files from: ${publicDirectoryPath}`); // Add log
app.use(express.static(publicDirectoryPath));

// 處理根路徑請求，導向大螢幕頁面 (可選)
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDirectoryPath, 'index.html'));
});

// 處理 /mobile 路徑請求，導向手機頁面
app.get('/mobile', (req, res) => {
    res.sendFile(path.join(publicDirectoryPath, 'mobile.html'));
});


// Socket.IO 連線處理
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // --- 監聽客戶端註冊類型 ---
  socket.on('registerClient', (data) => {
    const type = data.type;
    if (type === 'mobile' || type === 'screen') {
      clientTypes[socket.id] = type;
      console.log(`Client ${socket.id} registered as ${type}`);
      // 如果需要，可以在 users 物件中也存一份
      if (users[socket.id]) {
          users[socket.id].type = type;
      } else {
          // 注意：mobile 通常在 submitInfo 後才有 user 記錄
          // screen 可能根本不會在 users 中有記錄，除非我們改變邏輯
          // users[socket.id] = { type: type }; // 可以考慮這樣做
      }
    } else {
      console.warn(`Unknown client type registration from ${socket.id}: ${type}`);
    }
  });

  // 處理客戶端斷開連線
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // 清理相關用戶數據
    delete users[socket.id];
    delete clientTypes[socket.id]; // 同步刪除類型記錄
    // TODO: 通知大螢幕可能需要移除/更新氣球
  });

  // --- 處理手機提交資訊 ---
  socket.on('submitInfo', (data) => {
    const { name, supplier1, supplier2, supplier3 } = data; // 接收 supplier3
    console.log(`Info submitted from ${socket.id}: Name=${name}, Suppliers=${supplier1}, ${supplier2}, ${supplier3}`);

    // 儲存用戶資訊
    users[socket.id] = { 
        name: data.name,
        type: clientTypes[socket.id] || 'mobile' 
    };

    const newBalloons = [];
    const submittedByName = name; // 把提交者姓名存起來

    // 創建氣球 (現在有三個)
    [supplier1, supplier2, supplier3].forEach(supplier => {
        if (supplier) { // 確保供應商名稱存在
            const balloonId = nextBalloonId++;
            balloons[balloonId] = { 
                supplier: supplier, 
                submittedBy: submittedByName, // 儲存提交者姓名
                hitBy: null 
            };
            newBalloons.push({ id: balloonId, supplier: supplier });
        }
    });

    console.log('Current Balloons:', balloons);

    // 廣播新氣球資訊給所有客戶端 (主要是大螢幕)
    io.emit('newBalloons', newBalloons);
  });

  // --- 處理大螢幕 "開始給祝福" 指令 ---
  socket.on('startGame', () => {
    console.log(`'startGame' event received from ${socket.id}. Broadcasting to all clients.`);
    // 向所有客戶端廣播開始遊戲的信號
    io.emit('startGame');
    // 可以在這裡加入遊戲狀態的標記，例如 gameStarted = true;
  });

  // --- 處理手機射擊 ---
  socket.on('shootDart', (data) => {
    const { targetBalloonId1, targetBalloonId2 } = data; // 接收兩個 ID
    const user = users[socket.id];

    if (!user) {
      console.warn(`Shoot attempt from unknown user: ${socket.id}`);
      // 返回一個包含兩個失敗結果的陣列
      socket.emit('shotResult', [
        { shot: 1, success: false, message: '無法識別用戶身份' },
        { shot: 2, success: false, message: '無法識別用戶身份' }
      ]);
      return;
    }

    const shooterName = user.name;
    console.log(`[Server Debug] Retrieved user for socket ${socket.id}:`, JSON.stringify(user));
    console.log(`[Server Debug] Determined shooterName: ${shooterName}`);

    console.log(`Dart shot by ${shooterName} (${socket.id}) at balloons ${targetBalloonId1} and ${targetBalloonId2}`);

    const results = [];
    const targets = [targetBalloonId1, targetBalloonId2];

    targets.forEach((targetId, index) => {
        const shotNumber = index + 1;
        const targetBalloon = balloons[targetId];
        let result = { shot: shotNumber, success: false, message: '' }; // 初始化結果

        if (targetBalloon && targetBalloon.hitBy === null) {
            targetBalloon.hitBy = shooterName;
            console.log(`Balloon ${targetId} hit by ${shooterName}.`);

            // 廣播氣球被射中事件 (包含提交者和射中者姓名)
            io.emit('balloonHit', {
                balloonId: targetId,
                supplier: targetBalloon.supplier,
                submitterName: targetBalloon.submittedBy, // 提交者
                shooterName: shooterName // 新增：射中者
            });

            result.success = true;
            result.message = `成功射中 ${targetId}號 (${targetBalloon.supplier})！ (由 ${targetBalloon.submittedBy} 提交)`;
            result.details = { // 添加詳細資訊供客戶端使用
                balloonId: targetId,
                supplier: targetBalloon.supplier,
                submittedBy: targetBalloon.submittedBy
            };

        } else if (targetBalloon && targetBalloon.hitBy !== null) {
            console.log(`Balloon ${targetId} already hit by ${targetBalloon.hitBy}.`);
            result.success = false;
            result.message = `${targetId}號氣球已被 ${targetBalloon.hitBy} 射中！`;
        } else {
            console.log(`Balloon ${targetId} not found.`);
            result.success = false;
            result.message = `找不到 ${targetId}號 氣球！`;
        }
        results.push(result);
    });

    // 在發送前回顧一下要發送的內容 (增加日誌)
    console.log(`[Server] Prepared shotResult for socket ${socket.id}:`, JSON.stringify(results)); 

    // 回傳兩個射擊的結果給發射者
    socket.emit('shotResult', results);
    console.log('Current Balloons:', balloons); // 調試用
  });

  // --- 處理遊戲重設 --- 
  socket.on('resetGame', () => {
    // 只有螢幕端可以觸發重設 (可選，增加安全性)
    if (clientTypes[socket.id] === 'screen') {
        console.log(`'resetGame' event received from screen ${socket.id}. Resetting state.`);
        // 重設狀態變數
        users = {};
        balloons = {};
        clientTypes = {}; // 把類型也清掉，客戶端重連時會重新註冊
        nextBalloonId = 1;
        
        // 廣播遊戲已重設給所有客戶端
        io.emit('gameReset');
    } else {
        console.warn(`'resetGame' event received from non-screen client ${socket.id}. Ignoring.`);
    }
  });

});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
