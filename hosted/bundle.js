'use strict';

var canvas = void 0;
var chatCanvas = void 0;
var ctx = void 0;
var chatCtx = void 0;

// our websocket connection
var socket = void 0;
var hash = void 0;
var user = '';
var prevTime = void 0;
var chatting = false;
var userChat = '';
var chatMessages = [];
var newMessages = [];
var roomName = '';
var tokens = [];
var selectedToken = void 0;
var players = {};
var canAct = false;
var canVote = false;
var unusedRoles = [];

var inGame = false;
var sleeping = false;
var sleepObj = {
  x: 0,
  y: -800,
  prevX: 0,
  prevY: -800,
  destX: 0,
  destY: -800,
  alpha: 1.0
};

var screenMessage = {};
var timer = 10;

var lerp = function lerp(v0, v1, alpha) {
  return (1 - alpha) * v0 + alpha * v1;
};

var joinLobby = function joinLobby() {
  user = document.querySelector("#username").value;
  var playerSize = parseInt(document.querySelector("#playerSize").value);
  console.dir(playerSize);
  if (isNaN(playerSize) || playerSize < 4 || playerSize > 8) return;
  connect(playerSize);
  createGameCanvas();

  // Set up our canvas and chatCanvas
  canvas = document.querySelector('#canvas');
  ctx = canvas.getContext('2d');
  chatCanvas = document.querySelector('#chatCanvas');
  chatCtx = chatCanvas.getContext('2d');

  canvas.addEventListener('mousemove', mouseMoveHandler);
  canvas.addEventListener('click', mouseClickHandler);
  canvas.addEventListener('mousedown', mouseDownHandler);
  canvas.addEventListener('mouseup', mouseUpHandler);
  chatCanvas.addEventListener('click', mouseClickHandler);

  requestAnimationFrame(redraw);
};

var UsernameWindow = function UsernameWindow(props) {
  return React.createElement(
    'div',
    { className: 'newForm' },
    React.createElement(
      'label',
      { htmlFor: 'username' },
      'Username: '
    ),
    React.createElement('input', { id: 'username', type: 'text', name: 'username' }),
    React.createElement('br', null),
    React.createElement(
      'label',
      { htmlFor: 'username' },
      'Player Size (4-8): '
    ),
    React.createElement('input', { id: 'playerSize', type: 'text', name: 'playerSize' }),
    React.createElement(
      'div',
      { className: 'row' },
      React.createElement(
        'p',
        { className: 'centered' },
        React.createElement(
          'button',
          { className: 'btn-large waves-effect waves-light green', onClick: joinLobby },
          'Join Game'
        )
      )
    )
  );
};

var createUsernameWindow = function createUsernameWindow() {
  ReactDOM.render(React.createElement(UsernameWindow, null), document.querySelector("#content"));
};

var GameCanvas = function GameCanvas(props) {
  return React.createElement(
    'div',
    { id: 'canvasHolder' },
    React.createElement(
      'canvas',
      { id: 'canvas', height: '800', width: '700' },
      'Please use an HTML 5 browser'
    ),
    React.createElement('canvas', { id: 'chatCanvas', height: '800', width: '300' })
  );
};

var createGameCanvas = function createGameCanvas() {
  ReactDOM.render(React.createElement(GameCanvas, null), document.querySelector("#content"));
};

var wrapText = function wrapText(chat, text, x, startY, width, lineHeight) {
  // Code based on this tutorial:
  // https://www.html5canvastutorials.com/tutorials/html5-canvas-wrap-text-tutorial/
  var words = text.split(' ');
  var line = '';
  var y = startY;

  // Loop through each word in our message
  // Check if the line's width goes over when adding the line
  for (var i = 0; i < words.length; i++) {
    var testLine = '' + line + words[i] + ' ';
    var lineWidth = chat.measureText(testLine).width;
    if (lineWidth > width && i > 0) {
      chat.fillText(line, x, y);
      line = words[i] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  chat.fillText(line, x, y);
  return y;
};

// Draw chat messages to the screen
var drawMessages = function drawMessages() {
  // Draw all chat messages on the side
  chatCtx.fillStyle = 'black';
  chatCtx.font = '18px Helvetica';
  var currentY = 20;
  for (var i = chatMessages.length - 1; i >= 0; i--) {
    currentY = wrapText(chatCtx, chatMessages[i], 2, currentY, 300, 20) + 30;
  }
};

var drawChat = function drawChat() {
  // Draw the message the user is typing
  var messageText = user + ': ' + userChat;
  if (!sleeping) ctx.fillStyle = 'black';else ctx.fillStyle = 'white';
  ctx.font = '18px Helvetica';
  ctx.fillText(messageText, 20, 20);

  drawMessages();
};

var setPosition = function setPosition(pHash, x, y) {
  var p = players[pHash];

  p.x = x;
  p.y = y + 160;
};

var drawRoundRect = function drawRoundRect(x, y, size, cornerRadius) {
  ctx.beginPath();
  ctx.moveTo(x - size + cornerRadius, y - size);
  ctx.lineTo(x + size - cornerRadius, y - size);
  ctx.arcTo(x + size, y - size, x + size, y - size + cornerRadius, cornerRadius);
  ctx.lineTo(x + size, y + size - cornerRadius);
  ctx.arcTo(x + size, y + size, x + size - cornerRadius, y + size, cornerRadius);
  ctx.lineTo(x - size + cornerRadius, y + size);
  ctx.arcTo(x - size, y + size, x - size, y + size - cornerRadius, cornerRadius);
  ctx.lineTo(x - size, y - size + cornerRadius);
  ctx.arcTo(x - size, y - size, x - size + cornerRadius, y - size, cornerRadius);
};

var drawRoleCard = function drawRoleCard(x, y, role, flipped) {
  if (!flipped) {
    ctx.fillStyle = 'rgba(170, 170, 170, 0.6)';
    drawRoundRect(x, y, 45, 4);
    ctx.fill();
    ctx.stroke();
  } else {
    if (role === 'Villager' || role === 'Seer' || role === 'Robber' || role === 'Revealer' || role === 'Insomniac' || role === 'Mason') ctx.fillStyle = 'rgba(125, 168, 237, 0.8)';else if (role === 'Werewolf') ctx.fillStyle = 'rgba(193, 62, 42, 0.8)';else ctx.fillStyle = 'rgba(140, 140, 140, 0.8)';

    var cardText = role.substring(0, 3);
    drawRoundRect(x, y, 45, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'black';
    ctx.font = '20px Helvetica';
    ctx.fillText(cardText, x - ctx.measureText(cardText).width / 2, y + 5);
  }
};

var drawPlayer = function drawPlayer(pHash) {
  var p = players[pHash];

  // Draw the card of the player
  // Rounded rectangle tutorial: https://www.html5canvastutorials.com/tutorials/html5-canvas-rounded-corners/
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 3;
  if (!p.flipped) {
    drawRoleCard(p.x, p.y, p.role, p.flipped);
  }

  // Draw the player
  // This will be updated to display in the player's color or their icon
  ctx.fillStyle = 'rgba(240, 240, 240, 1.0)';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // If a player's card has been flipped, we display it on top of them
  if (p.flipped) {
    drawRoleCard(p.x, p.y, p.role, p.flipped);
  }

  // Write the player's name under them
  ctx.fillStyle = 'black';
  ctx.font = '18px Helvetica';
  ctx.fillText(p.name, p.x - ctx.measureText(p.name).width / 2, p.y + 62);
};

var drawPlayers = function drawPlayers() {
  var keys = Object.keys(players);
  for (var i = 0; i < keys.length; i++) {
    drawPlayer(keys[i]);
  }
};

var drawUnusedRoles = function drawUnusedRoles() {
  if (unusedRoles.length > 0) {
    drawRoleCard(unusedRoles[0].x, unusedRoles[0].y, unusedRoles[0].role, unusedRoles[0].flipped);
    drawRoleCard(unusedRoles[1].x, unusedRoles[1].y, unusedRoles[1].role, unusedRoles[1].flipped);
    drawRoleCard(unusedRoles[2].x, unusedRoles[2].y, unusedRoles[2].role, unusedRoles[2].flipped);
  }
};

var drawToken = function drawToken(token) {
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 3;

  if (token.role === 'Villager' || token.role === 'Seer' || token.role === 'Robber' || token.role === 'Revealer' || token.role === 'Insomniac' || token.role === 'Mason') ctx.fillStyle = 'rgba(125, 168, 237, 0.8)';else if (token.role === 'Werewolf') ctx.fillStyle = 'rgba(193, 62, 42, 0.8)';else ctx.fillStyle = 'rgba(140, 140, 140, 0.8)';

  ctx.beginPath();
  ctx.arc(token.x, token.y, 25, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  var tokenText = token.role.substring(0, 3);
  ctx.fillStyle = 'black';
  ctx.font = '18px Helvetica';
  ctx.fillText(tokenText, token.x - ctx.measureText(tokenText).width / 2, token.y + 5);
};

var drawGame = function drawGame(deltaTime) {
  // Draw our timer
  ctx.font = '24px Helvetica';
  ctx.fillStyle = 'black';
  ctx.fillText('Timer: ' + timer, 350 - ctx.measureText('Timer: ' + timer).width / 2, 40);

  // Draw all the players in the game
  drawPlayers();

  // Draw the 3 unused Roles
  drawUnusedRoles();

  // Draw the tokens
  if (tokens.length > 0) {
    for (var i = tokens.length - 1; i >= 0; i--) {
      drawToken(tokens[i]);
    }
  }

  // Draw our sleepObj
  if (sleepObj.alpha < 1) {
    sleepObj.alpha += deltaTime / 10;
    sleepObj.y = lerp(sleepObj.prevY, sleepObj.destY, sleepObj.alpha);
  } else {
    sleepObj.y = sleepObj.destY;
  }
  ctx.fillStyle = 'black';
  ctx.fillRect(sleepObj.x, sleepObj.y, 700, 800);

  if (chatting) drawChat();else drawMessages();
  // if (chatting) drawChat();
  // else if (newMessages.length > 0) drawNewMessages();
};

var redraw = function redraw(time) {
  var deltaTime = (time - prevTime) / 100;
  prevTime = time;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  chatCtx.clearRect(0, 0, chatCanvas.width, chatCanvas.height);

  if (inGame) {
    drawGame(deltaTime);
  }

  if (screenMessage) {
    if (screenMessage.alpha > 0) {
      if (screenMessage.disappear) {
        // Reduce the alpha if this message disappears
        screenMessage.alpha -= 0.003;
      }

      // Draw the message to the screen
      // https://www.w3schools.com/tags/canvas_measuretext.asp
      ctx.font = '32px Helvetica';
      ctx.fillStyle = 'rgba(0, 0, 0, ' + screenMessage.alpha + ')';
      var textX = 350 - ctx.measureText(screenMessage.message).width / 2;
      ctx.fillText(screenMessage.message, textX, 280);

      if (screenMessage.submessage) {
        ctx.font = '24px Helvetica';
        ctx.fillStyle = 'rgba(0, 0, 0, ' + screenMessage.alpha + ')';
        var subtextX = 350 - ctx.measureText(screenMessage.submessage).width / 2;
        ctx.fillText(screenMessage.submessage, subtextX, 320);
      }
    }
  }

  requestAnimationFrame(redraw);
};

var setPlayerPositions = function setPlayerPositions() {
  var keys = Object.keys(players);
  switch (keys.length) {
    case 1:
      setPosition(keys[0], canvas.width / 2.0, canvas.height / 2.0);
      break;
    case 2:
      setPosition(keys[0], canvas.width / 2.0, canvas.height / 2.0 - 150);
      setPosition(keys[1], canvas.width / 2.0, canvas.height / 2.0 + 150);
      break;
    case 3:
      setPosition(keys[0], canvas.width / 2.0, canvas.height / 2.0 - 150);
      setPosition(keys[1], canvas.width / 2.0 + 150, canvas.height / 2.0 + 150);
      setPosition(keys[2], canvas.width / 2.0 - 150, canvas.height / 2.0 + 150);
      break;
    case 4:
      setPosition(keys[0], canvas.width / 2.0 - 150, canvas.height / 2.0 - 150);
      setPosition(keys[1], canvas.width / 2.0 + 150, canvas.height / 2.0 - 150);
      setPosition(keys[2], canvas.width / 2.0 + 150, canvas.height / 2.0 + 150);
      setPosition(keys[3], canvas.width / 2.0 - 150, canvas.height / 2.0 + 150);
      break;
    case 5:
      setPosition(keys[0], canvas.width / 2.0, canvas.height / 2.0 - 150);
      setPosition(keys[1], canvas.width / 2.0 + 150, canvas.height / 2.0);
      setPosition(keys[2], canvas.width / 2.0 + 80, canvas.height / 2.0 + 150);
      setPosition(keys[3], canvas.width / 2.0 - 80, canvas.height / 2.0 + 150);
      setPosition(keys[4], canvas.width / 2.0 - 150, canvas.height / 2.0);
      break;
    case 6:
      setPosition(keys[0], canvas.width / 2.0 - 80, canvas.height / 2.0 - 150);
      setPosition(keys[1], canvas.width / 2.0 + 80, canvas.height / 2.0 - 150);
      setPosition(keys[2], canvas.width / 2.0 + 150, canvas.height / 2.0);
      setPosition(keys[3], canvas.width / 2.0 + 80, canvas.height / 2.0 + 150);
      setPosition(keys[4], canvas.width / 2.0 - 80, canvas.height / 2.0 + 150);
      setPosition(keys[5], canvas.width / 2.0 - 150, canvas.height / 2.0);
      break;
    case 7:
      setPosition(keys[0], canvas.width / 2.0, canvas.height / 2.0 - 190);
      setPosition(keys[1], canvas.width / 2.0 + 130, canvas.height / 2.0 - 100);
      setPosition(keys[2], canvas.width / 2.0 + 200, canvas.height / 2.0 + 50);
      setPosition(keys[3], canvas.width / 2.0 + 80, canvas.height / 2.0 + 190);
      setPosition(keys[4], canvas.width / 2.0 - 80, canvas.height / 2.0 + 190);
      setPosition(keys[5], canvas.width / 2.0 - 200, canvas.height / 2.0 + 50);
      setPosition(keys[6], canvas.width / 2.0 - 130, canvas.height / 2.0 - 100);
      break;
    case 8:
      setPosition(keys[0], canvas.width / 2.0 - 75, canvas.height / 2.0 - 200);
      setPosition(keys[1], canvas.width / 2.0 + 75, canvas.height / 2.0 - 200);
      setPosition(keys[2], canvas.width / 2.0 + 200, canvas.height / 2.0 - 75);
      setPosition(keys[3], canvas.width / 2.0 + 200, canvas.height / 2.0 + 75);
      setPosition(keys[4], canvas.width / 2.0 + 75, canvas.height / 2.0 + 200);
      setPosition(keys[5], canvas.width / 2.0 - 75, canvas.height / 2.0 + 200);
      setPosition(keys[6], canvas.width / 2.0 - 200, canvas.height / 2.0 + 75);
      setPosition(keys[7], canvas.width / 2.0 - 200, canvas.height / 2.0 - 75);
      break;
  }
};

var setUser = function setUser(data) {
  roomName = data.roomName;

  var h = data.hash;
  hash = h;
  players[hash] = { name: data.name };
  if (roomName != 'Lobby') inGame = true;
};

var addUser = function addUser(data) {
  players[data.hash] = { name: data.name, hash: data.hash };
  setPlayerPositions();
};

var setPlayers = function setPlayers(data) {
  players = data.players;

  setPlayerPositions();
};

var removeUser = function removeUser(rHash) {
  if (players[rHash]) {
    delete players[rHash];
  }
  setPlayerPositions();
};

var keyPressHandler = function keyPressHandler(e) {
  if (chatting) {
    e.preventDefault();
    var keyPressed = e.which;

    userChat = '' + userChat + String.fromCharCode(keyPressed);
  }
};

var keyDownHandler = function keyDownHandler(e) {
  if (inGame) {
    var keyPressed = e.which;
    if (chatting) {
      if ((keyPressed === 8 || keyPressed === 46) && userChat.length > 0) {
        e.preventDefault();
        userChat = userChat.substr(0, userChat.length - 1);
        return;
      }
    }

    if (keyPressed === 13) {
      e.preventDefault();
      // Enter starts or ends chat
      if (chatting) {
        // Send the message to the server
        if (userChat !== '') {
          socket.emit('message', { sender: user, message: userChat, roomName: roomName });
        }
        userChat = '';
        chatting = false;
      } else {
        chatting = true;
      }
    }
  }
};

var mouseMoveHandler = function mouseMoveHandler(e) {
  var mouseX = e.pageX - canvas.offsetLeft;
  var mouseY = e.pageY - canvas.offsetTop;
  canvas.style.cursor = 'default';

  if (selectedToken) {
    selectedToken.x = mouseX;
    selectedToken.y = mouseY;
  }

  if (tokens.length > 0) {
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      ctx.beginPath();
      ctx.arc(token.x, token.y, 25, 0, Math.PI * 2);
      ctx.closePath();
      if (ctx.isPointInPath(mouseX, mouseY)) {
        canvas.style.cursor = 'pointer';
        return;
      }
    }
  }

  if (canVote) {
    var keys = Object.keys(players);
    for (var _i = 0; _i < keys.length; _i++) {
      var p = players[keys[_i]];
      drawRoundRect(p.x, p.y, 45, 4);
      if (ctx.isPointInPath(mouseX, mouseY)) {
        canvas.style.cursor = 'pointer';
        return;
      }
    }
  }

  if (canAct) {
    if (players[hash].startRole === 'Werewolf' || players[hash].startRole === 'Seer') {
      for (var _i2 = 0; _i2 < unusedRoles.length; _i2++) {
        var card = unusedRoles[_i2];
        drawRoundRect(card.x, card.y, 45, 4);
        if (ctx.isPointInPath(mouseX, mouseY)) {
          canvas.style.cursor = 'pointer';
          return;
        }
      }
    }

    if (players[hash].startRole === 'Seer' || players[hash].startRole === 'Robber' || players[hash].startRole === 'Revealer') {
      var _keys = Object.keys(players);
      for (var _i3 = 0; _i3 < _keys.length; _i3++) {
        var _p = players[_keys[_i3]];
        drawRoundRect(_p.x, _p.y, 45, 4);
        if (ctx.isPointInPath(mouseX, mouseY)) {
          canvas.style.cursor = 'pointer';
          return;
        }
      }
    }
  }
};

var addScreenMessage = function addScreenMessage(data) {
  screenMessage = {
    message: data.message,
    submessage: data.submessage,
    disappear: data.disappear,
    alpha: 1.0
  };
};

// Add a chat message to the client
var addChatMessage = function addChatMessage(data) {
  chatMessages.push(data);
  newMessages.push(data);
  setTimeout(function () {
    newMessages.splice(newMessages.indexOf(data), 1);
  }, 5000);
};

var sleep = function sleep() {
  sleeping = true;
  sleepObj.alpha = 0;
  sleepObj.destY = 0;
  sleepObj.prevY = -800;
  for (var i = 0; i < unusedRoles.length; i++) {
    unusedRoles[i].flipped = false;
  }
};

var wake = function wake() {
  sleeping = false;
  sleepObj.alpha = 0;
  sleepObj.destY = -800;
  sleepObj.prevY = 0;
};

var flip = function flip(data) {
  var p = players[data.hash];
  p.flipped = data.flipped;
};

var flipAll = function flipAll(data) {
  var keys = Object.keys(players);
  for (var i = 0; i < keys.length; i++) {
    flip({ hash: keys[i], flipped: data.flipped });
  }
};

var setStartRole = function setStartRole(data) {
  var p = players[data.hash];
  p.startRole = data.role;
  p.role = data.role;
};

var setRole = function setRole(data) {
  var p = players[data.hash];
  p.role = data.role;
};

var setUnusedRoles = function setUnusedRoles(data) {
  var roles = data.roles;

  for (var i = 0; i < roles.length; i++) {
    var x = canvas.width / 4 * (i + 1);
    unusedRoles.push({
      role: roles[i],
      flipped: false,
      x: x,
      y: 120
    });
  }
};

var setTokens = function setTokens(data) {
  tokens.length = 0;
  var xOffset = (700 - data.tokens.length * 60) / 2 + 30;
  for (var i = 0; i < data.tokens.length; i++) {
    var token = {
      role: data.tokens[i],
      x: i * 60 + xOffset,
      y: 210
    };
    tokens.push(token);
  }
};

var connect = function connect(playerSize) {
  socket = io.connect();

  socket.on('connect', function () {
    if (!user) {
      user = 'unknown';
    }

    socket.emit('join', { name: user, playerSize: playerSize });
  });

  socket.on('joined', setUser);

  socket.on('left', removeUser);

  socket.on('screenMessage', addScreenMessage);

  socket.on('addPlayer', addUser);

  socket.on('setPlayers', setPlayers);

  socket.on('addMessage', addChatMessage);

  socket.on('sleep', sleep);

  socket.on('wake', wake);

  socket.on('flip', flip);

  socket.on('flipAll', flipAll);

  socket.on('setStartRole', setStartRole);

  socket.on('setRole', setRole);

  socket.on('setUnusedRoles', setUnusedRoles);

  socket.on('changeAct', function (data) {
    canAct = data;
  });

  socket.on('setTokens', setTokens);

  socket.on('setTimer', function (data) {
    timer = data.time;
  });

  socket.on('canVote', function () {
    canVote = true;
  });

  socket.on('night', function () {
    document.body.style.background = 'rgba(63, 59, 69, 0.45)';
  });

  socket.on('day', function () {
    document.body.style.background = 'rgba(119, 234, 255, 0.12)';
  });
};

var handleAction = function handleAction(clickedObj) {
  if (!canAct) return;
  if (players[hash].startRole === 'Werewolf') {
    if (clickedObj.hash || !clickedObj.role) return;

    canAct = false;
    unusedRoles[unusedRoles.indexOf(clickedObj)].flipped = true;
    clickedObj.flipped = true;
  }
  if (players[hash].startRole === 'Seer') {
    if (clickedObj.hash) {
      var clickedRoles = 0;
      for (var i = 0; i < unusedRoles.length; i++) {
        if (unusedRoles[i].flipped) clickedRoles++;
      }
      console.dir(clickedRoles);

      if (clickedRoles === 0) {
        canAct = false;
        clickedObj.flipped = true;
      }
    } else if (clickedObj.role) {
      var _clickedRoles = 0;
      for (var _i4 = 0; _i4 < unusedRoles.length; _i4++) {
        if (unusedRoles[_i4].flipped) _clickedRoles++;
      }

      if (_clickedRoles < 2) {
        unusedRoles[unusedRoles.indexOf(clickedObj)].flipped = true;
        clickedObj.flipped = true;

        _clickedRoles++;
        if (_clickedRoles === 2) canAct = false;
      }
    }
  }
  if (players[hash].startRole === 'Robber') {
    if (!clickedObj.hash) return;

    canAct = false;
    socket.emit('changeRole', { roomName: roomName, hash: hash, newRole: clickedObj.role });
    socket.emit('changeRole', { roomName: roomName, hash: clickedObj.hash, newRole: 'Robber' });
    flip({ hash: hash, flipped: true });
  }
  if (players[hash].startRole === 'Revealer') {
    if (!clickedObj.hash) return;

    canAct = false;
    if (clickedObj.role === 'Tanner' || clickedObj.role === 'Werewolf') {
      addScreenMessage({ message: 'The card could not be flipped!', submessage: 'This player is a Tanner or a Werewolf.' });
    } else {
      var pHash = clickedObj.hash;
      socket.emit('revealerFlip', { roomName: roomName, hash: pHash });
    }
  }
};

var handleVote = function handleVote(clickedPlayer) {
  // You cannot vote for yourself
  if (clickedPlayer.hash === hash) return;

  canVote = false;
  addScreenMessage({ message: 'You have voted for ' + clickedPlayer.name });
  socket.emit('vote', { roomName: roomName, hash: clickedPlayer.hash });
};

var checkPlayerClick = function checkPlayerClick(mX, mY) {
  var keys = Object.keys(players);
  for (var i = 0; i < keys.length; i++) {
    var player = players[keys[i]];
    if (mX >= player.x - 30 && mX <= player.x + 30) {
      if (mY >= player.y - 30 && mY <= player.y + 30) {
        return player;
      }
    }
  }
  return {};
};

var checkRoleClick = function checkRoleClick(mX, mY) {
  for (var i = 0; i < unusedRoles.length; i++) {
    var card = unusedRoles[i];
    if (mX >= card.x - 50 && mX <= card.x + 50) {
      if (mY >= card.y - 50 && mY <= card.y + 50) {
        return card;
      }
    }
  }
  return {};
};

var mouseClickHandler = function mouseClickHandler(e) {
  var mouseX = e.pageX - canvas.offsetLeft;
  var mouseY = e.pageY - canvas.offsetTop;

  if (canAct) {
    var clickedPlayer = checkPlayerClick(mouseX, mouseY);
    if (clickedPlayer) handleAction(clickedPlayer);
    var clickedRole = checkRoleClick(mouseX, mouseY);
    if (clickedRole) handleAction(clickedRole);
  } else if (canVote) {
    var votedPlayer = checkPlayerClick(mouseX, mouseY);
    if (votedPlayer.hash) handleVote(votedPlayer);
  }
};

var mouseDownHandler = function mouseDownHandler(e) {
  var mouseX = e.pageX - canvas.offsetLeft;
  var mouseY = e.pageY - canvas.offsetTop;

  if (tokens.length > 0) {
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      ctx.beginPath();
      ctx.arc(token.x, token.y, 25, 0, Math.PI * 2);
      ctx.closePath();
      if (ctx.isPointInPath(mouseX, mouseY)) {
        selectedToken = token;
        return;
      }
    }
  }
};

var mouseUpHandler = function mouseUpHandler() {
  selectedToken = {};
};

var init = function init() {
  createUsernameWindow();

  document.body.addEventListener('keydown', keyDownHandler);
  document.body.addEventListener('keypress', keyPressHandler);
};

window.onload = init;
