const http = require('http');
const socketio = require('socket.io');
const xxh = require('xxhashjs');

const fs = require('fs');

const mongoose = require('mongoose');

const dbURL = process.env.MONGODB_URI || 'mongodb://localhost/rt-project3';

const Player = require('./models/Player.js').PlayerModel;

mongoose.connect(dbURL, (err) => {
  if (err) {
    console.log('Could not connect to database');
    throw err;
  }
});

const PORT = process.env.PORT || process.env.NODE_PORT || 3000;

const getPlayersFromDB = (request, response) => {
  const res = response;
  return Player.find({}, (err, docs) => {
    if (err) {
      console.log(err);
      return res.status(400).json({ error: 'An error occurred' });
    }
    return res.json({ players: docs });
  });
};

const handler = (req, res) => {
  if (req.url === '/bundle.js') {
    fs.readFile(`${__dirname}/../hosted/bundle.js`, (err, data) => {
      res.writeHead(200, {
        'Content-Type': 'application/javascript',
      });
      res.end(data);
    });
  } else if (req.url === '/style.css') {
    fs.readFile(`${__dirname}/../hosted/style.css`, (err, data) => {
      res.writeHead(200, {
        'Content-Type': 'text/css',
      });
      res.end(data);
    });
  } else if (req.url === '/getPlayers') {
    getPlayersFromDB(req, res);
  } else {
    // Read our file ASYNCHRONOUSLY from the file system.
    fs.readFile(`${__dirname}/../hosted/index.html`, (err, data) => {
      // if err, throw it for now
      if (err) {
        throw err;
      }
      res.writeHead(200);
      res.end(data);
    });
  }
};

const app = http.createServer(handler);
const io = socketio(app);

app.listen(PORT);

// Array of rooms that exist on our server
// Each room has roomName, joinable, users, chatMessages
const rooms = [];
let roomCount = 0; // Number of rooms created since the server started

const createNewRoom = () => {
  roomCount++;
  const roomObj = {
    roomName: `Room${roomCount}`,
    joinable: true,
    running: false,
    users: {},
    chatMessages: [],
  };

  rooms.push(roomObj);
  return rooms[rooms.indexOf(roomObj)];
};

/* const getBestRoom = () => {
  let bestRoom;
  let userCount = -1;

  // If there are no rooms, create one
  if (rooms.length === 0) {
    return createNewRoom();
  }

  // Otherwise, we loop through our rooms and see if at least one is joinable
  let joinable = false;
  for (let i = 0; i < rooms.length; i++) {
    if (rooms[i].joinable) {
      joinable = true;
      break;
    }
  }

  // If no rooms are joinable, create a new room
  if (!joinable) return createNewRoom();

  // Otherwise, we have at least one joinable room
  // Loop through our rooms and find the joinable room with the most users
  for (let i = 0; i < rooms.length; i++) {
    const checkRoom = rooms[i];
    if (checkRoom.joinable) {
      const keys = Object.keys(checkRoom.users);
      if (keys.length < 4 && keys.length > userCount) {
        userCount = keys.length;
        bestRoom = checkRoom;
      }
    }
  }

  if (!bestRoom) return createNewRoom();

  return bestRoom;
}; */

const getRoom = (rName) => {
  for (let i = 0; i < rooms.length; i++) {
    if (rooms[i].roomName === rName) return rooms[i];
  }
  return null;
};

/* const endGame = (r) => {
  const room = r;
  room.state = 'end';

  // We want to get a collection of players on the winning team and update their wins
  // Update our database based on the results of this game
  // If a user has never won a game before, add them as an entry
  // Otherwise, update the wins of the existing entry
  Player.findOne({ name: winner.name }, (err, doc) => {
    if (!doc) {
      // Create a new player with 1 win
      const playerData = {
        name: winner.name,
        wins: 1,
      };

      const newPlayer = new Player(playerData);
      newPlayer.save();
    } else {
      // Update the existing player
      const player = doc;
      player.wins++;
      player.save();
    }
  });
}; */

const onJoined = (sock) => {
  sock.on('join', (data) => {
    // For this prototype, every player will be in their own room
    const socket = sock;
    const room = createNewRoom();

    socket.join(room.roomName);

    // Server itself doesn't care about height, width, prevX, and prevY (unless collisions)
    socket.hash = xxh.h32(`${socket.id}${new Date().getTime()}`, 0xDEADBEEF).toString(16);

    room.users[socket.hash] = { name: data.name };

    // Start the game when there are 4 players
    io.sockets.in(room.roomName).emit('screenMessage', { message: `${data.name} has joined the game`, submessage: 'Welcome!', disappear: true });

    socket.roomName = room.roomName;

    socket.emit('joined', {
      name: data.name,
      roomName: socket.roomName,
      hash: socket.hash,
    });

    io.sockets.in(room.roomName).emit('addPlayer', { name: data.name, hash: socket.hash });
  });
};

io.on('connection', (sock) => {
  const socket = sock;

  onJoined(socket);

  socket.on('disconnect', () => {
    io.sockets.in(socket.roomName).emit('left', socket.hash);

    socket.leave(socket.roomName);
  });

  socket.on('createPlayer', (data) => {
    const room = getRoom(data.roomName);
    const userNum = Object.keys(room.users).length + 1;
    const playerName = `player${userNum}`;
    room.users[playerName] = { name: playerName };

    // We're using the playerName as the hash since this is just a test player
    io.sockets.in(room.roomName).emit('addPlayer', { name: playerName, hash: playerName });
  });

  socket.on('removePlayer', (data) => {
    const room = getRoom(data.roomName);
    const userNum = Object.keys(room.users).length;
    const playerName = `player${userNum}`;

    delete room.users[playerName];

    // We're using the playerName as the hash since this is just a test player
    io.sockets.in(room.roomName).emit('left', playerName);
  });

  socket.on('message', (data) => {
    const chatMessage = `${data.sender}: ${data.message}`;
    io.sockets.in(data.roomName).emit('addMessage', chatMessage);
  });
});

const getUsers = rName => getRoom(rName).users;

console.log(`listening on port ${PORT}`);

module.exports.getUsers = getUsers;
module.exports.rooms = rooms;
