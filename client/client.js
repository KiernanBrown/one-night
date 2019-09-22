let canvas;
let chatCanvas;
let ctx;
let chatCtx;

// our websocket connection
let socket;
let hash;
let user = '';
let prevTime;
let chatting = false;
let userChat = '';
const chatMessages = [];
const newMessages = [];
let roomName = '';
const tokens = [];
let selectedToken;
let players = {};
let canAct = false;
let canVote = false;
const unusedRoles = [];

let inGame = false;
let sleeping = false;
const sleepObj = {
  x: 0,
  y: -800,
  prevX: 0,
  prevY: -800,
  destX: 0,
  destY: -800,
  alpha: 1.0,
};

let screenMessage = {};
let timer = 10;

const lerp = (v0, v1, alpha) => ((1 - alpha) * v0) + (alpha * v1);

const joinLobby = () => {
  user = document.querySelector("#username").value;
  let playerSize = parseInt(document.querySelector("#playerSize").value);
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

const UsernameWindow = (props) => {
  return (
    <div className='newForm'>
      <label htmlFor="username">Username: </label>
      <input id="username" type="text" name="username"/>
      <br />
      <label htmlFor="username">Player Size (4-8): </label>
      <input id="playerSize" type="text" name="playerSize"/>
      <div className="row">
        <p className="centered"><button className="btn-large waves-effect waves-light green" onClick={joinLobby}>Join Game</button></p>
      </div>
    </div>
  );
};

const createUsernameWindow = () => {
  ReactDOM.render(
    <UsernameWindow />,
    document.querySelector("#content")
  );
};

const GameCanvas = (props) => {
  return (
    <div id="canvasHolder">
      <canvas id="canvas" height="800" width="700">Please use an HTML 5 browser</canvas>
      <canvas id="chatCanvas" height="800" width="300"></canvas>
    </div>
  );
};

const RoleInfo = (props) => {
  return (
    <div>
      <h5>Team and Role Information</h5>
      <ul>
        <p>Werewolf Team: This team wins if all werewolves survive the vote at the end of the day.</p>
        <ul>
          <li>Werewolf (Wer): This role is part of the werewolf team. Werewolves wake up at the start of the night and are able to see the other werewolves on their team. If there is only one werewolf present in the game, the werewolf can look at one of the the 3 unused role cards. The werewolf team wins if all werewolves survive the vote at the end of the day. Lie, trick, and deceive the villagers to protect yourself and your teammates.</li>
        </ul>
        <p>Villager Team: This team wins if at least one werewolf is killed during the vote at the end of the day. If no werewolves are present, then the villager team wins if no players are killed during the vote.</p>
        <ul>
          <li>Villager (Vil): This role is part of the villager team. Villagers have no special action for their role.</li>
          <li>Mason (Mas): This role is part of the villager team. There will always be 2 mason cards in the game if the mason role is being used. Masons wake up during the night and see who the other masons are. If you are the only mason who woke up, then the other mason card is one of the unused role cards.</li>
          <li>The Seer (See): This role is part of the villager team. The Seer can choose to either view the role card of another player in the game, or to view up to 2 of the unused role cards in the game. Use the information you gain from your role action to steer your team in the right direction during your discussion.</li>
          <li>The Robber (Rob): This role is part of the villager team. The Robber can choose to swap their role card with the role card of another player, and then look at your new role card. The card you steal becomes your new role, so you might need to switch up your playstyle depending on which role you stole.</li>
          <li>The Insomniac (Ins): This role is part of the villager team. The Insomniac has trouble sleeping, and they wake up towards the end of the night to check their role card. This allows the insomniac to see if their role was changed during the night.</li>
          <li>The Revealer (Rev): This role is part of the villager team. The Revealer can attempt to flip over the role card of another player, and that card will remain face up for the rest of the game. If the role card you attempt to flip is a Werewolf or Tanner, then you will be unable to flip the card.</li>
        </ul>
        <p>Third Parties: Third Party roles have their own goals and win conditions.</p>
        <ul>
          <li>The Tanner (Tan): The Tanner hates his job, and his only goal is to die. You win if you die during the vote at the end of the day.</li>
        </ul>
      </ul>
    </div>
  );
};

const createGameCanvas = () => {
  ReactDOM.render(
    <GameCanvas />,
    document.querySelector("#content")
  );
    
  ReactDOM.render(
    <RoleInfo />,
    document.querySelector("#role-info")
  );
};

const wrapText = (chat, text, x, startY, width, lineHeight) => {
  // Code based on this tutorial:
  // https://www.html5canvastutorials.com/tutorials/html5-canvas-wrap-text-tutorial/
  const words = text.split(' ');
  let line = '';
  let y = startY;

  // Loop through each word in our message
  // Check if the line's width goes over when adding the line
  for (let i = 0; i < words.length; i++) {
    const testLine = `${line}${words[i]} `;
    const lineWidth = chat.measureText(testLine).width;
    if (lineWidth > width && i > 0) {
      chat.fillText(line, x, y);
      line = `${words[i]} `;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  chat.fillText(line, x, y);
  return y;
};

// Draw chat messages to the screen
const drawMessages = () => {
  // Draw all chat messages on the side
  chatCtx.fillStyle = 'black';
  chatCtx.font = '18px Helvetica';
  let currentY = 20;
  for (let i = chatMessages.length - 1; i >= 0; i--) {
    currentY = wrapText(chatCtx, chatMessages[i], 2, currentY, 300, 20) + 30;
  }
};

const drawChat = () => {
  // Draw the message the user is typing
  const messageText = `${user}: ${userChat}`;
  if (!sleeping) ctx.fillStyle = 'black';
  else ctx.fillStyle = 'white';
  ctx.font = '18px Helvetica';
  ctx.fillText(messageText, 20, 20);

  drawMessages();
};

const setPosition = (pHash, x, y) => {
  const p = players[pHash];

  p.x = x;
  p.y = y + 160;
};

const drawRoundRect = (x, y, size, cornerRadius) => {
  ctx.beginPath();
  ctx.moveTo((x - size) + cornerRadius, y - size);
  ctx.lineTo((x + size) - cornerRadius, y - size);
  ctx.arcTo(x + size, y - size, x + size, (y - size) + cornerRadius, cornerRadius);
  ctx.lineTo(x + size, (y + size) - cornerRadius);
  ctx.arcTo(x + size, y + size, (x + size) - cornerRadius, y + size, cornerRadius);
  ctx.lineTo((x - size) + cornerRadius, y + size);
  ctx.arcTo(x - size, y + size, x - size, (y + size) - cornerRadius, cornerRadius);
  ctx.lineTo(x - size, (y - size) + cornerRadius);
  ctx.arcTo(x - size, y - size, (x - size) + cornerRadius, y - size, cornerRadius);
};

const drawRoleCard = (x, y, role, flipped) => {
  if (!flipped) {
    ctx.fillStyle = 'rgba(170, 170, 170, 0.6)';
    drawRoundRect(x, y, 45, 4);
    ctx.fill();
    ctx.stroke();
  } else {
    if (role === 'Villager' || role === 'Seer' || role === 'Robber' || role === 'Revealer' || role === 'Insomniac' || role === 'Mason') ctx.fillStyle = 'rgba(125, 168, 237, 0.8)';
    else if (role === 'Werewolf') ctx.fillStyle = 'rgba(193, 62, 42, 0.8)';
    else ctx.fillStyle = 'rgba(140, 140, 140, 0.8)';

    const cardText = role.substring(0, 3);
    drawRoundRect(x, y, 45, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'black';
    ctx.font = '20px Helvetica';
    ctx.fillText(cardText, x - (ctx.measureText(cardText).width / 2), y + 5);
  }
};

const drawPlayer = (pHash) => {
  const p = players[pHash];

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
  ctx.fillText(p.name, p.x - (ctx.measureText(p.name).width / 2), p.y + 62);
};

const drawPlayers = () => {
  const keys = Object.keys(players);
  for (let i = 0; i < keys.length; i++) {
    drawPlayer(keys[i]);
  }
};

const drawUnusedRoles = () => {
  if (unusedRoles.length > 0) {
    drawRoleCard(unusedRoles[0].x, unusedRoles[0].y, unusedRoles[0].role, unusedRoles[0].flipped);
    drawRoleCard(unusedRoles[1].x, unusedRoles[1].y, unusedRoles[1].role, unusedRoles[1].flipped);
    drawRoleCard(unusedRoles[2].x, unusedRoles[2].y, unusedRoles[2].role, unusedRoles[2].flipped);
  }
};

const drawToken = (token) => {
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 3;

  if (token.role === 'Villager' || token.role === 'Seer' || token.role === 'Robber' || token.role === 'Revealer' || token.role === 'Insomniac' || token.role === 'Mason') ctx.fillStyle = 'rgba(125, 168, 237, 0.8)';
  else if (token.role === 'Werewolf') ctx.fillStyle = 'rgba(193, 62, 42, 0.8)';
  else ctx.fillStyle = 'rgba(140, 140, 140, 0.8)';

  ctx.beginPath();
  ctx.arc(token.x, token.y, 25, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const tokenText = token.role.substring(0, 3);
  ctx.fillStyle = 'black';
  ctx.font = '18px Helvetica';
  ctx.fillText(tokenText, token.x - (ctx.measureText(tokenText).width / 2), token.y + 5);
};

const drawGame = (deltaTime) => {
  // Draw our timer
  ctx.font = '24px Helvetica';
  ctx.fillStyle = 'black';
  ctx.fillText(`Timer: ${timer}`, 350 - (ctx.measureText(`Timer: ${timer}`).width / 2), 44);

  // Draw all the players in the game
  drawPlayers();

  // Draw the 3 unused Roles
  drawUnusedRoles();

  // Draw the tokens
  if (tokens.length > 0) {
    for (let i = tokens.length - 1; i >= 0; i--) {
      drawToken(tokens[i]);
    }
    
    // Draw text under the tokens
    ctx.fillStyle = 'black';
    ctx.font = '16px Helvetica';
    ctx.fillText('Moveable Role Tokens for information tracking', canvas.width / 2 - (ctx.measureText('Moveable Role Tokens for information tracking').width / 2), 176);
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

  if (chatting) drawChat();
  else drawMessages();
  // if (chatting) drawChat();
  // else if (newMessages.length > 0) drawNewMessages();
};

const redraw = (time) => {  
  const deltaTime = (time - prevTime) / 100;
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
      ctx.fillStyle = `rgba(0, 0, 0, ${screenMessage.alpha})`;
      const textX = 350 - (ctx.measureText(screenMessage.message).width / 2);
      ctx.fillText(screenMessage.message, textX, 280);

      if (screenMessage.submessage) {
        ctx.font = '24px Helvetica';
        ctx.fillStyle = `rgba(0, 0, 0, ${screenMessage.alpha})`;
        const subtextX = 350 - (ctx.measureText(screenMessage.submessage).width / 2);
        ctx.fillText(screenMessage.submessage, subtextX, 320);
      }
    }
  }

  requestAnimationFrame(redraw);
};

const setPlayerPositions = () => {
  const keys = Object.keys(players);
  switch (keys.length) {
    case 1: setPosition(keys[0], canvas.width / 2.0, canvas.height / 2.0);
      break;
    case 2: setPosition(keys[0], canvas.width / 2.0, (canvas.height / 2.0) - 150);
      setPosition(keys[1], canvas.width / 2.0, (canvas.height / 2.0) + 150);
      break;
    case 3: setPosition(keys[0], canvas.width / 2.0, (canvas.height / 2.0) - 150);
      setPosition(keys[1], (canvas.width / 2.0) + 150, (canvas.height / 2.0) + 150);
      setPosition(keys[2], (canvas.width / 2.0) - 150, (canvas.height / 2.0) + 150);
      break;
    case 4: setPosition(keys[0], (canvas.width / 2.0) - 150, (canvas.height / 2.0) - 150);
      setPosition(keys[1], (canvas.width / 2.0) + 150, (canvas.height / 2.0) - 150);
      setPosition(keys[2], (canvas.width / 2.0) + 150, (canvas.height / 2.0) + 150);
      setPosition(keys[3], (canvas.width / 2.0) - 150, (canvas.height / 2.0) + 150);
      break;
    case 5: setPosition(keys[0], canvas.width / 2.0, (canvas.height / 2.0) - 150);
      setPosition(keys[1], (canvas.width / 2.0) + 150, (canvas.height / 2.0));
      setPosition(keys[2], (canvas.width / 2.0) + 80, (canvas.height / 2.0) + 150);
      setPosition(keys[3], (canvas.width / 2.0) - 80, (canvas.height / 2.0) + 150);
      setPosition(keys[4], (canvas.width / 2.0) - 150, (canvas.height / 2.0));
      break;
    case 6: setPosition(keys[0], (canvas.width / 2.0) - 80, (canvas.height / 2.0) - 150);
      setPosition(keys[1], (canvas.width / 2.0) + 80, (canvas.height / 2.0) - 150);
      setPosition(keys[2], (canvas.width / 2.0) + 150, (canvas.height / 2.0));
      setPosition(keys[3], (canvas.width / 2.0) + 80, (canvas.height / 2.0) + 150);
      setPosition(keys[4], (canvas.width / 2.0) - 80, (canvas.height / 2.0) + 150);
      setPosition(keys[5], (canvas.width / 2.0) - 150, (canvas.height / 2.0));
      break;
    case 7: setPosition(keys[0], (canvas.width / 2.0), (canvas.height / 2.0) - 150);
      setPosition(keys[1], (canvas.width / 2.0) + 130, (canvas.height / 2.0) - 100);
      setPosition(keys[2], (canvas.width / 2.0) + 200, (canvas.height / 2.0) + 50);
      setPosition(keys[3], (canvas.width / 2.0) + 80, (canvas.height / 2.0) + 150);
      setPosition(keys[4], (canvas.width / 2.0) - 80, (canvas.height / 2.0) + 150);
      setPosition(keys[5], (canvas.width / 2.0) - 200, (canvas.height / 2.0) + 50);
      setPosition(keys[6], (canvas.width / 2.0) - 130, (canvas.height / 2.0) - 100);
      break;
    case 8: setPosition(keys[0], (canvas.width / 2.0) - 75, (canvas.height / 2.0) - 150);
      setPosition(keys[1], (canvas.width / 2.0) + 75, (canvas.height / 2.0) - 150);
      setPosition(keys[2], (canvas.width / 2.0) + 200, (canvas.height / 2.0) - 75);
      setPosition(keys[3], (canvas.width / 2.0) + 200, (canvas.height / 2.0) + 75);
      setPosition(keys[4], (canvas.width / 2.0) + 75, (canvas.height / 2.0) + 150);
      setPosition(keys[5], (canvas.width / 2.0) - 75, (canvas.height / 2.0) + 150);
      setPosition(keys[6], (canvas.width / 2.0) - 200, (canvas.height / 2.0) + 75);
      setPosition(keys[7], (canvas.width / 2.0) - 200, (canvas.height / 2.0) - 75);
      break;
  }
};

const setUser = (data) => {
  ({ roomName } = data);
  const h = data.hash;
  hash = h;
  players[hash] = { name: data.name };
  if (roomName != 'Lobby') inGame = true;
};

const addUser = (data) => {
  players[data.hash] = { name: data.name, hash: data.hash };
  setPlayerPositions();
};

const setPlayers = (data) => {
  ({ players } = data);
  setPlayerPositions();
};

const removeUser = (rHash) => {
  if (players[rHash]) {
    delete players[rHash];
  }
  setPlayerPositions();
};

const keyPressHandler = (e) => {
  if (chatting) {
    e.preventDefault();
    const keyPressed = e.which;

    userChat = `${userChat}${String.fromCharCode(keyPressed)}`;
  }
};

const keyDownHandler = (e) => {
  if (inGame) {
    const keyPressed = e.which;
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
          socket.emit('message', { sender: user, message: userChat, roomName });
        }
        userChat = '';
        chatting = false;
      } else {
        chatting = true;
      }
    }
  }
};

const mouseMoveHandler = (e) => {
  const mouseX = e.pageX - canvas.offsetLeft;
  const mouseY = e.pageY - canvas.offsetTop;
  canvas.style.cursor = 'default';

  if (selectedToken) {
    selectedToken.x = mouseX;
    selectedToken.y = mouseY;
  }

  if (tokens.length > 0) {
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
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
    const keys = Object.keys(players);
    for (let i = 0; i < keys.length; i++) {
      const p = players[keys[i]];
      drawRoundRect(p.x, p.y, 45, 4);
      if (ctx.isPointInPath(mouseX, mouseY)) {
        canvas.style.cursor = 'pointer';
        return;
      }
    }
  }

  if (canAct) {
    if (players[hash].startRole === 'Werewolf' || players[hash].startRole === 'Seer') {
      for (let i = 0; i < unusedRoles.length; i++) {
        const card = unusedRoles[i];
        drawRoundRect(card.x, card.y, 45, 4);
        if (ctx.isPointInPath(mouseX, mouseY)) {
          canvas.style.cursor = 'pointer';
          return;
        }
      }
    }

    if (players[hash].startRole === 'Seer' || players[hash].startRole === 'Robber' || players[hash].startRole === 'Revealer') {
      const keys = Object.keys(players);
      for (let i = 0; i < keys.length; i++) {
        const p = players[keys[i]];
        drawRoundRect(p.x, p.y, 45, 4);
        if (ctx.isPointInPath(mouseX, mouseY)) {
          canvas.style.cursor = 'pointer';
          return;
        }
      }
    }
  }
};

const addScreenMessage = (data) => {
  screenMessage = {
    message: data.message,
    submessage: data.submessage,
    disappear: data.disappear,
    alpha: 1.0,
  };
};

// Add a chat message to the client
const addChatMessage = (data) => {
  chatMessages.push(data);
  newMessages.push(data);
  setTimeout(() => { newMessages.splice(newMessages.indexOf(data), 1); }, 5000);
};

const sleep = () => {
  sleeping = true;
  sleepObj.alpha = 0;
  sleepObj.destY = 0;
  sleepObj.prevY = -800;
  for (let i = 0; i < unusedRoles.length; i++) {
    unusedRoles[i].flipped = false;
  }
};

const wake = () => {
  sleeping = false;
  sleepObj.alpha = 0;
  sleepObj.destY = -800;
  sleepObj.prevY = 0;
};

const flip = (data) => {
  const p = players[data.hash];
  p.flipped = data.flipped;
};

const flipAll = (data) => {
  const keys = Object.keys(players);
  for (let i = 0; i < keys.length; i++) {
    flip({ hash: keys[i], flipped: data.flipped });
  }
};

const flipUnused = (data) => {
  for(let i = 0; i < unusedRoles.length; i++) {
    unusedRoles[i].flipped = data.flipped;
  }
};

const setStartRole = (data) => {
  const p = players[data.hash];
  p.startRole = data.role;
  p.role = data.role;
};

const setRole = (data) => {
  const p = players[data.hash];
  p.role = data.role;
};

const setUnusedRoles = (data) => {
  const { roles } = data;
  for (let i = 0; i < roles.length; i++) {
    const x = (canvas.width / 4) * (i + 1);
    unusedRoles.push({
      role: roles[i],
      flipped: false,
      x,
      y: 100,
    });
  }
};

const setTokens = (data) => {
  tokens.length = 0;
  const xOffset = ((700 - (data.tokens.length * 60)) / 2) + 30;
  for (let i = 0; i < data.tokens.length; i++) {
    const token = {
      role: data.tokens[i],
      x: (i * 60) + xOffset,
      y: 210,
    };
    tokens.push(token);
  }
};

const connect = (playerSize) => {
  socket = io.connect();
  
  socket.on('connect', () => {                
    if(!user) {
      user = 'unknown';
    }
                
    socket.emit('join', { name: user, playerSize });
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
  
  socket.on('flipUnused', flipUnused);

  socket.on('setStartRole', setStartRole);

  socket.on('setRole', setRole);

  socket.on('setUnusedRoles', setUnusedRoles);

  socket.on('changeAct', (data) => {
    canAct = data;
  });
  
  socket.on('setTokens', setTokens);
  
  socket.on('setTimer', (data) => {
    timer = data.time;
  });
  
  socket.on('canVote', () => {
    canVote = true;
    setTimeout(() => {
      canVote = false;
    }, 10000);
  });
  
  socket.on('night', () => {
    document.body.style.background = 'rgba(63, 59, 69, 0.45)';
  });
  
  socket.on('day', () => {
    document.body.style.background = 'white';
  });
};

const handleAction = (clickedObj) => {
  if (!canAct) return;
  if (players[hash].startRole === 'Werewolf') {
    if (clickedObj.hash || !clickedObj.role) return;

    canAct = false;
    unusedRoles[unusedRoles.indexOf(clickedObj)].flipped = true;
    clickedObj.flipped = true;
  }
  if (players[hash].startRole === 'Seer') {
    if (clickedObj.hash) {
      let clickedRoles = 0;
      for (let i = 0; i < unusedRoles.length; i++) {
        if (unusedRoles[i].flipped) clickedRoles++;
      }
      console.dir(clickedRoles);
      
      if (clickedRoles === 0) {  
        canAct = false;
        clickedObj.flipped = true;
      }
    } else if (clickedObj.role) {
      let clickedRoles = 0;
      for (let i = 0; i < unusedRoles.length; i++) {
        if (unusedRoles[i].flipped) clickedRoles++;
      }
      
      if (clickedRoles < 2) {
        unusedRoles[unusedRoles.indexOf(clickedObj)].flipped = true;
        clickedObj.flipped = true;
        
        clickedRoles++;
        if (clickedRoles === 2) canAct = false;
      }
    }
  }
  if (players[hash].startRole === 'Robber') {
    if (!clickedObj.hash) return;

    canAct = false;
    socket.emit('changeRole', { roomName, hash, newRole: clickedObj.role });
    socket.emit('changeRole', { roomName, hash: clickedObj.hash, newRole: 'Robber' });
    flip({ hash, flipped: true });
  }
  if (players[hash].startRole === 'Revealer') {
    if (!clickedObj.hash) return;

    canAct = false;
    if (clickedObj.role === 'Tanner' || clickedObj.role === 'Werewolf') {
      addScreenMessage({ message: 'The card could not be flipped!', submessage: 'This player is a Tanner or a Werewolf.' });
    } else {
      const pHash = clickedObj.hash;
      socket.emit('revealerFlip', { roomName, hash: pHash });
    }
  }
};

const handleVote = (clickedPlayer) => {
  // You cannot vote for yourself
  if (clickedPlayer.hash === hash) return;

  canVote = false;
  addScreenMessage({ message: `You have voted for ${clickedPlayer.name}` });
  socket.emit('vote', { roomName, hash: clickedPlayer.hash });
};

const checkPlayerClick = (mX, mY) => {
  const keys = Object.keys(players);
  for (let i = 0; i < keys.length; i++) {
    const player = players[keys[i]];
    if (mX >= player.x - 30 && mX <= player.x + 30) {
      if (mY >= player.y - 30 && mY <= player.y + 30) {
        return player;
      }
    }
  }
  return {};
};

const checkRoleClick = (mX, mY) => {
  for (let i = 0; i < unusedRoles.length; i++) {
    const card = unusedRoles[i];
    if (mX >= card.x - 50 && mX <= card.x + 50) {
      if (mY >= card.y - 50 && mY <= card.y + 50) {
        return card;
      }
    }
  }
  return {};
};

const mouseClickHandler = (e) => {
  const mouseX = e.pageX - canvas.offsetLeft;
  const mouseY = e.pageY - canvas.offsetTop;

  if (canAct) {
    const clickedPlayer = checkPlayerClick(mouseX, mouseY);
    if (clickedPlayer) handleAction(clickedPlayer);
    const clickedRole = checkRoleClick(mouseX, mouseY);
    if (clickedRole) handleAction(clickedRole);
  } else if (canVote) {
    const votedPlayer = checkPlayerClick(mouseX, mouseY);
    if (votedPlayer.hash) handleVote(votedPlayer);
  }
};

const mouseDownHandler = (e) => {
  const mouseX = e.pageX - canvas.offsetLeft;
  const mouseY = e.pageY - canvas.offsetTop;

  if (tokens.length > 0) {
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
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

const mouseUpHandler = () => {
  selectedToken = {};
};

const init = () => {
  createUsernameWindow();

  document.body.addEventListener('keydown', keyDownHandler);
  document.body.addEventListener('keypress', keyPressHandler);
};

window.onload = init;
