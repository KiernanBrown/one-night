let canvas;
let chatCanvas;
let ctx;
let chatCtx;

// our websocket connection
let socket;
let hash;
let user = '';
let moveDown = false;
let moveUp = false;
let moveRight = false;
let moveLeft = false;
let prevTime;
// let chatting = false;
let userChat = '';
// let chatMessages = [];
// let newMessages = [];
let roomName = '';

const squares = {};
const slashLines = {};
let enemies = [];

let inGame = false;

let screenMessage = {};

const update = (data) => {
  if (!squares[data.hash]) {
    squares[data.hash] = data;
    return;
  }

  // if we were using io.sockets.in or socket.emit
  // to forcefully move this user back because of
  // collision, error, invalid data, etc
  /**
  if(data.hash === hash) {
    //force update user somehow
    return;
  } * */

  const square = squares[data.hash];

  if (square.lastUpdate >= data.lastUpdate) {
    return;
  }

  square.lastUpdate = data.lastUpdate;
  square.prevX = data.prevX;
  square.prevY = data.prevY;
  square.destX = data.destX;
  square.destY = data.destY;
  square.alpha = 0.05;
  square.mouseX = data.mouseX;
  square.mouseY = data.mouseY;
  square.slashCooldown = data.slashCooldown;
};

const lerp = (v0, v1, alpha) => ((1 - alpha) * v0) + (alpha * v1);

const updatePosition = (deltaTime) => {
  const square = squares[hash];

  if (square) {
    square.prevX = square.x;
    square.prevY = square.y;

    if (square.slashCooldown <= 3) {
      if (moveUp && square.destY > square.height / 2) {
        square.destY -= 18 * deltaTime;
      }
      if (moveDown && square.destY < canvas.height - (square.height / 2)) {
        square.destY += 18 * deltaTime;
      }
      if (moveLeft && square.destX > square.width / 2) {
        square.destX -= 18 * deltaTime;
      }
      if (moveRight && square.destX < canvas.width - (square.width / 2)) {
        square.destX += 18 * deltaTime;
      }
    }

    // Reset our alpha since we are moving
    square.alpha = 0.05;

    // Emit a movementUpdate
    socket.emit('movementUpdate', square);
  }
};

/* // Draw chat messages to the screen
const drawChat = () => {

};

// Draw any newly posted messages to the screen
const drawNewMessages = () => {
  for (let i = newMessages.length; i > 0; i--) {

  }
}; */

const drawGame = (deltaTime) => {
  // Draw the enemies
  if (enemies.length > 0) {
    ctx.fillStyle = 'red';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (enemy.alive) {
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        ctx.strokeRect(enemy.x, enemy.y, enemy.width, enemy.height);
      }
    }
  }

  const keys = Object.keys(squares);

  // Sort our keys by lastUpdate
  // More recently updated characters are drawn on top
  // keys.sort((a, b) => squares[a].lastUpdate - squares[b].lastUpdate);

  for (let i = 0; i < keys.length; i++) {
    const square = squares[keys[i]];

    if (square.alive) {
      if (square.alpha < 1) square.alpha += 0.05;
      if (square.slashCooldown > 0) square.slashCooldown -= deltaTime;

      square.x = lerp(square.prevX, square.destX, square.alpha);
      square.y = lerp(square.prevY, square.destY, square.alpha);

      square.angle = Math.atan2(square.mouseX - square.x, -(square.mouseY - square.y));

      if (slashLines[square.hash]) {
        const slashLine = slashLines[square.hash];
        slashLine.alpha -= deltaTime / 8;
        if (square.slashCooldown <= 3 && slashLine.alpha !== 0) {
          // Tell the server to remove the line
          // socket.emit('slashLineRemove', slashLine);
          slashLine.alpha = 0;
          socket.emit('updatedSlashLine', slashLine);
        } else {
          slashLine.p2X = square.x;
          slashLine.p2Y = square.y;

          socket.emit('updatedSlashLine', slashLine);

          // Draw the line
          ctx.save();
          ctx.setLineDash([5, 10]);
          ctx.lineWidth = 4;
          if (slashLine.hits.length > 0) ctx.strokeStyle = `rgba(255, 0, 0, ${slashLine.alpha})`;
          else ctx.strokeStyle = `rgba(0, 0, 0, ${slashLine.alpha})`;
          ctx.beginPath();
          ctx.moveTo(slashLine.p1X, slashLine.p1Y);
          ctx.lineTo(slashLine.p2X, slashLine.p2Y);
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.save();
      ctx.translate(square.x, square.y);
      ctx.rotate(square.angle);
      const slashAlpha = (1 / (square.slashCooldown + 1)) * 0.8;

      if (square.hash === hash) {
        ctx.fillStyle = `rgba(0, 0, 255, ${slashAlpha})`;

        // Draw a line in the direction you're facing
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.setLineDash([5, 10]);
        ctx.moveTo(0, 0 - (square.height / 2));
        ctx.lineTo(0, 0 - (square.height / 2) - 50);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(0, 0, 0, ${slashAlpha})`;
      }
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3;

      // Draw the triangle for the character
      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.moveTo(0, 0 - (square.height / 2));
      ctx.lineTo(0 + (square.width / 2), 0 + (square.height / 2));
      ctx.lineTo(0 - (square.width / 2), 0 + (square.height / 2));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }
  }
};

const drawMenu = () => {
  // Draw objects for our top 3 players

  // Draw our play button
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 5;
  ctx.fillStyle = 'green';
  ctx.fillRect(200, 200, 200, 140);
  ctx.strokeRect(200, 200, 200, 140);
  ctx.font = '32px Helvetica';
  ctx.fillStyle = 'black';
  ctx.fillText('Play', 300 - (ctx.measureText('Play').width / 2), 270);
};

const redraw = (time) => {
  const deltaTime = (time - prevTime) / 100;
  prevTime = time;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (inGame) {
    updatePosition(deltaTime);
    drawGame(deltaTime);
  } else {
    drawMenu();
  }

  if (screenMessage) {
    if (screenMessage.alpha > 0) {
      if (screenMessage.disappear) {
        // Reduce the alpha if this message disappears
        screenMessage.alpha -= 0.005;
      }

      // Draw the message to the screen
      // https://www.w3schools.com/tags/canvas_measuretext.asp
      ctx.font = '32px Helvetica';
      ctx.fillStyle = `rgba(0, 0, 0, ${screenMessage.alpha})`;
      const textX = 300 - (ctx.measureText(screenMessage.message).width / 2);
      ctx.fillText(screenMessage.message, textX, 270);

      if (screenMessage.submessage) {
        ctx.font = '24px Helvetica';
        ctx.fillStyle = `rgba(0, 0, 0, ${screenMessage.alpha})`;
        const subtextX = 300 - (ctx.measureText(screenMessage.submessage).width / 2);
        ctx.fillText(screenMessage.submessage, subtextX, 320);
      }
    }
  }

  requestAnimationFrame(redraw);
};

const setUser = (data) => {
  roomName = data.roomName;
  const h = data.character.hash;
  hash = h;
  squares[hash] = data.character;
};

const removeUser = (rHash) => {
  if (squares[rHash]) {
    delete squares[rHash];
  }
};

/* const keyPressHandler = (e) => {
  if (chatting) {
    const keyPressed = e.which;

    userChat = `${userChat}${String.fromCharCode(keyPressed)}`;
    console.dir(userChat);
  }
}; */

const keyDownHandler = (e) => {
  if (inGame) {
    const keyPressed = e.which;
    /* if (chatting) {
      if ((keyPressed === 8 || keyPressed === 46) && userChat.length > 0) {
        userChat = userChat.substr(0, userChat.length - 1);
        console.dir(userChat);
      }
    } else */
    if (keyPressed === 87 || keyPressed === 38) {
      // W OR UP
      moveUp = true;
    } else if (keyPressed === 65 || keyPressed === 37) {
      // A OR LEFT
      moveLeft = true;
    } else if (keyPressed === 83 || keyPressed === 40) {
      // S OR DOWN
      moveDown = true;
    } else if (keyPressed === 68 || keyPressed === 39) {
      // D OR RIGHT
      moveRight = true;
    }

    /* if (keyPressed === 13) {
      // Enter starts or ends chat
      if (chatting) {
        console.dir('Done chatting');
        console.dir(userChat);

        // Send the message to the server

        userChat = '';
        chatting = false;
      } else {
        chatting = true;
      }
    } */

    // if one of these keys is down, let's cancel the browsers
    // default action so the page doesn't try to scroll on the user
    if (moveUp || moveDown || moveLeft || moveRight) {
      e.preventDefault();
    }
  }
};

const keyUpHandler = (e) => {
  const keyPressed = e.which;

  if (keyPressed === 87 || keyPressed === 38) {
    // W OR UP
    moveUp = false;
  } else if (keyPressed === 65 || keyPressed === 37) {
    // A OR LEFT
    moveLeft = false;
  } else if (keyPressed === 83 || keyPressed === 40) {
    // S OR DOWN
    moveDown = false;
  } else if (keyPressed === 68 || keyPressed === 39) {
    // D OR RIGHT
    moveRight = false;
  }
};

const mouseMoveHandler = (e) => {
  if (squares[hash]) {
    const square = squares[hash];
    square.mouseX = e.pageX - canvas.offsetLeft;
    square.mouseY = e.pageY - canvas.offsetTop;

    socket.emit('movementUpdate', square);
  }
};

const slash = (e) => {
  if (squares[hash]) {
    const square = squares[hash];
    if (square.slashCooldown <= 0) {
      square.mouseX = e.pageX - canvas.offsetLeft;
      square.mouseY = e.pageY - canvas.offsetTop;

      const directionX = square.x - square.mouseX;
      const directionY = square.y - square.mouseY;
      const magnitude = Math.sqrt((directionX ** 2) + (directionY ** 2));

      const dX = directionX / magnitude;
      const dY = directionY / magnitude;

      // Move 180 units in the direciton of the mouse cursor
      square.slashCooldown = 10;
      square.destX -= dX * 180;
      square.destY -= dY * 180;

      // Create a slash line for the player
      slashLines[square.hash] = {
        hash: square.hash,
        p1X: square.x,
        p1Y: square.y,
        p2X: square.x,
        p2Y: square.y,
        alpha: 1.0,
        hits: [],
        roomName,
      };

      // Tell the server to add the slash line
      socket.emit('slashLineCreated', slashLines[square.hash]);
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

const connect = () => {
  
  socket = io.connect();
  
  socket.on('connect', () => {
    user = document.querySelector("#username").value;
                
    if(!user) {
      user = 'unknown';
    }
                
    socket.emit('join', { name: user });
  });

  socket.on('joined', setUser);

  socket.on('updatedMovement', update);

  socket.on('left', removeUser);

  socket.on('addLine', (data) => {
    slashLines[data.hash] = data;
  });

  socket.on('updateEnemies', (data) => {
    enemies = data;
  });

  socket.on('updateScore', (data) => {
    squares[data.hash].score = data.score;
  });
  
  socket.on('screenMessage', addScreenMessage);
};

const mouseClickHandler = (e) => {
  if (inGame) slash(e);
  else {
    const mouseX = e.pageX - canvas.offsetLeft;
    const mouseY = e.pageY - canvas.offsetTop;

    if (mouseX >= 200 && mouseX <= 400) {
      if (mouseY >= 200 && mouseY <= 340) {
        inGame = true;
        connect();
      }
    }
  }
};

const init = () => {
  canvas = document.querySelector('#canvas');
  ctx = canvas.getContext('2d');
  chatCanvas = document.querySelector('#chatCanvas');
  chatCtx = chatCanvas.getContext('2d');

  document.body.addEventListener('keydown', keyDownHandler);
  document.body.addEventListener('keyup', keyUpHandler);
  // document.body.addEventListener('keypress', keyPressHandler);
  canvas.addEventListener('mousemove', mouseMoveHandler);
  canvas.addEventListener('click', mouseClickHandler);
  chatCanvas.addEventListener('mousemove', mouseMoveHandler);
  chatCanvas.addEventListener('click', mouseClickHandler);
  
  requestAnimationFrame(redraw);
};

window.onload = init;
