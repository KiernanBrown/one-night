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
const roomTimeouts = [];
// const roomIntervals = [];
let roomCount = 0; // Number of rooms created since the server started

const createNewRoom = () => {
  roomCount++;
  const roomObj = {
    roomName: `Room${roomCount}`,
    joinable: true,
    running: false,
    users: {},
    roles: ['Villager', 'Villager', 'Seer', 'Robber', 'Insomniac', 'Revealer', 'Werewolf', 'Werewolf', 'Tanner'],
    chatMessages: [],
  };

  rooms.push(roomObj);
  return rooms[rooms.indexOf(roomObj)];
};

const assignRoles = (r) => {
  const room = r;
  const availableRoles = room.roles.slice(0, room.roles.length);
  const { users } = room;
  const keys = Object.keys(users);

  // Give each user a role
  for (let i = 0; i < keys.length; i++) {
    const role = availableRoles[Math.floor(Math.random() * availableRoles.length)];
    users[keys[i]].startRole = role;
    users[keys[i]].role = role;
    availableRoles.splice(availableRoles.indexOf(role), 1);
    io.sockets.in(room.roomName).emit('setStartRole', { hash: keys[i], role });
  }

  // The 3 available roles become the 3 card roles
  room.cardRoles = availableRoles;

  io.sockets.in(room.roomName).emit('setUnusedRoles', { roles: room.cardRoles });

  console.dir(users);
};

const getBestRoom = () => {
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
      if (keys.length < 6 && keys.length > userCount) {
        userCount = keys.length;
        bestRoom = checkRoom;
      }
    }
  }

  if (!bestRoom) return createNewRoom();

  return bestRoom;
};

const getRoom = (rName) => {
  for (let i = 0; i < rooms.length; i++) {
    if (rooms[i].roomName === rName) return rooms[i];
  }
  return null;
};

// Function to decrease the timer by 1
/* const decreaseTimer = (r) => {
  const room = r;
  room.timer--;
  io.sockets.in(room.roomName).emit('setTimer', {
    time: room.timer,
  });
}; */


const findPlayers = (r, role) => {
  const room = r;
  const players = [];
  const { users } = room;
  const keys = Object.keys(users);
  for (let i = 0; i < keys.length; i++) {
    console.dir(users[keys[i]].startRole);
    if (users[keys[i]].startRole === role) players.push(users[keys[i]]);
  }

  return players;
};

const handleRoleActions = (r) => {
  console.dir('In actions');
  const room = r;
  const { roles } = room;
  const roomIndex = rooms.indexOf(room);
  let foundPlayers;

  // Give a 10 second timer to take an action
  room.timer = 10;
  clearTimeout(roomTimeouts[roomIndex]);
  roomTimeouts[roomIndex] = setTimeout(() => {
    room.actionCount++;
    handleRoleActions(room);
  }, 12000);

  if (room.actionCount === 0) {
    if (roles.includes('Werewolf')) {
      foundPlayers = findPlayers(room, 'Werewolf');
      console.dir(foundPlayers);
      if (foundPlayers.length === 1) {
        // One werewolf is present in the game, the werewolf can look at a center card
        io.to(foundPlayers[0].socketID).emit('wake');
        io.to(foundPlayers[0].socketID).emit('changeAct', true);
        io.to(foundPlayers[0].socketID).emit('screenMessage', { message: 'Werewolf, wake up!', submessage: 'You may view one of the unused role cards.' });
        setTimeout(() => {
          io.to(foundPlayers[0].socketID).emit('sleep');
          io.to(foundPlayers[0].socketID).emit('changeAct', false);
        }, 10000);
      } else if (foundPlayers.length > 0) {
        // Multiple werewolves, they all wake up and are highlighted
        // Have the socket emit a highlight to the players
        for (let i = 0; i < foundPlayers.length; i++) {
          io.to(foundPlayers[i].socketID).emit('wake');
          io.to(foundPlayers[i].socketID).emit('screenMessage', { message: 'Werewolves, wake up!', submessage: 'Take a look at your other werewolves.' });
          for (let j = 0; j < foundPlayers.length; j++) {
            io.to(foundPlayers[i].socketID).emit('flip', { hash: foundPlayers[j].hash, flipped: true });
          }
        }

        setTimeout(() => {
          for (let i = 0; i < foundPlayers.length; i++) {
            io.to(foundPlayers[i].socketID).emit('sleep');
            io.to(foundPlayers[i].socketID).emit('flipAll', { flipped: false });
          }
        }, 10000);
      }
    } else room.actionCount++;
  }

  if (room.actionCount === 1) {
    if (roles.includes('Seer')) {
      foundPlayers = findPlayers(room, 'Seer');
      if (foundPlayers.length > 0) {
        // Seer wakes up, they can look at two center cards or one other player's card
        io.to(foundPlayers[0].socketID).emit('wake');
        io.to(foundPlayers[0].socketID).emit('changeAct', true);
        io.to(foundPlayers[0].socketID).emit('screenMessage', { message: 'Seer, wake up!', submessage: "Look at another player's role, or up to two of the unused roles." });
        setTimeout(() => {
          io.to(foundPlayers[0].socketID).emit('sleep');
          io.to(foundPlayers[0].socketID).emit('changeAct', false);
          io.to(foundPlayers[0].socketID).emit('flipAll', { flipped: false });
        }, 10000);
      }
    } else room.actionCount++;
  }

  if (room.actionCount === 2) {
    if (roles.includes('Robber')) {
      foundPlayers = findPlayers(room, 'Robber');
      if (foundPlayers.length > 0) {
        // Robber wakes up and can swap cards with another player, then flip their card
        io.to(foundPlayers[0].socketID).emit('wake');
        io.to(foundPlayers[0].socketID).emit('changeAct', true);
        io.to(foundPlayers[0].socketID).emit('screenMessage', { message: 'Robber, wake up!', submessage: 'Swap your role with another player, and see your new role.' });
        setTimeout(() => {
          io.to(foundPlayers[0].socketID).emit('sleep');
          io.to(foundPlayers[0].socketID).emit('changeAct', false);
          io.to(foundPlayers[0].socketID).emit('flip', { hash: foundPlayers[0].hash, flipped: false });
        }, 10000);
      }
    } else room.actionCount++;
  }

  if (room.actionCount === 3) {
    if (roles.includes('Insomniac')) {
      foundPlayers = findPlayers(room, 'Insomniac');
      if (foundPlayers.length > 0) {
        // Insomniac wakes up and their card is flipped so they can view it
        io.to(foundPlayers[0].socketID).emit('wake');
        io.to(foundPlayers[0].socketID).emit('flip', { hash: foundPlayers[0].hash, flipped: true });
        io.to(foundPlayers[0].socketID).emit('screenMessage', { message: 'Insomniac, wake up!', submessage: 'Look at your card and see if your role has changed.' });
        setTimeout(() => {
          io.to(foundPlayers[0].socketID).emit('sleep');
          io.to(foundPlayers[0].socketID).emit('flip', { hash: foundPlayers[0].hash, flipped: false });
        }, 10000);
      }
    } else room.actionCount++;
  }

  if (room.actionCount === 4) {
    if (roles.includes('Revealer')) {
      foundPlayers = findPlayers(room, 'Revealer');
      if (foundPlayers.length > 0) {
        // Revealer wakes up and attempts to flip over a player's card
        // If the card is werewolf or a tanner, the card stays face down
        // This is a change from the base game, where Revealer can gain some information
        // but not the specific role of a player
        io.to(foundPlayers[0].socketID).emit('wake');
        io.to(foundPlayers[0].socketID).emit('changeAct', true);
        io.to(foundPlayers[0].socketID).emit('screenMessage', { message: 'Revealer, wake up!', submessage: "Attempt to flip over another player's card." });
        setTimeout(() => {
          io.to(foundPlayers[0].socketID).emit('sleep');
          io.to(foundPlayers[0].socketID).emit('changeAct', false);
        }, 10000);
      }
    } else room.actionCount++;
  }

  if (room.actionCount === 5) {
    clearTimeout(roomTimeouts[roomIndex]);
    console.dir('done with actions');
    io.sockets.in(room.roomName).emit('wake');
    io.sockets.in(room.roomName).emit('screenMessage', { message: 'Everyone wake up!', submessage: 'You have 5 minutes to discuss before voting', disappear: true });
  }
};

const startGame = (r) => {
  const room = r;

  assignRoles(room);

  room.timer = 10;
  room.actionCount = 0;
  io.sockets.in(room.roomName).emit('screenMessage', { message: 'All players have been given their roles!', submessage: 'You have 10 seconds before you fall asleep.', disappear: true });
  const { users } = room;
  const keys = Object.keys(users);
  for (let i = 0; i < keys.length; i++) {
    io.to(users[keys[i]].socketID).emit('flip', { hash: users[keys[i]].hash, flipped: true });
  }

  const roomIndex = rooms.indexOf(room);
  clearTimeout(roomTimeouts[roomIndex]);
  roomTimeouts[roomIndex] = setTimeout(() => {
    io.sockets.in(room.roomName).emit('sleep');
    for (let i = 0; i < keys.length; i++) {
      io.to(users[keys[i]].socketID).emit('flip', { hash: keys[i], flipped: false });
    }
    roomTimeouts[roomIndex] = setTimeout(() => {
      handleRoleActions(room);
    }, 2000);
  }, 10000);
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
    const room = getBestRoom();

    socket.join(room.roomName);

    // Server itself doesn't care about height, width, prevX, and prevY (unless collisions)
    socket.hash = xxh.h32(`${socket.id}${new Date().getTime()}`, 0xDEADBEEF).toString(16);

    room.users[socket.hash] = { name: data.name, socketID: socket.id, hash: socket.hash };

    // Start the game when there are 6 players
    io.sockets.in(room.roomName).emit('screenMessage', { message: `${data.name} has joined!`, submessage: `${6 - Object.keys(room.users).length} more players needed to start the game`, disappear: true });

    socket.roomName = room.roomName;

    socket.emit('joined', {
      name: data.name,
      roomName: socket.roomName,
      hash: socket.hash,
      socketID: socket.id,
    });

    console.dir(room.users);

    socket.emit('setPlayers', { players: room.users });

    socket.broadcast.to(room.roomName).emit('addPlayer', { name: data.name, hash: socket.hash });

    if (Object.keys(room.users).length === 6) {
      startGame(room);
    }
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

  socket.on('changeRole', (data) => {
    const room = getRoom(data.roomName);
    room.users[data.hash].role = data.newRole;
    io.sockets.in(data.roomName).emit('setRole', { hash: data.hash, role: data.newRole });
  });

  socket.on('revealerFlip', (data) => {
    io.sockets.in(data.roomName).emit('flip', { hash: data.hash, flipped: true });
  });
});

const getUsers = rName => getRoom(rName).users;

console.log(`listening on port ${PORT}`);

module.exports.getUsers = getUsers;
module.exports.rooms = rooms;
