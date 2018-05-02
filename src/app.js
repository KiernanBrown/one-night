const http = require('http');
const socketio = require('socket.io');
const xxh = require('xxhashjs');

const path = require('path');
const express = require('express');
const compression = require('compression');
const expressHandlebars = require('express-handlebars');
const bodyParser = require('body-parser');

const PORT = process.env.PORT || process.env.NODE_PORT || 3000;

// Require our router
const router = require('./router.js');

const app = express();
app.use('/assets', express.static(path.resolve(`${__dirname}/../hosted/`)));
app.disable('x-powered-by');
app.use(compression());
app.use(bodyParser.urlencoded({
  extended: true,
}));
app.engine('handlebars', expressHandlebars({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');
app.set('views', `${__dirname}/../views`);
router(app);

const server = http.createServer(app);
const io = socketio(server);

server.listen(PORT);


// Array of rooms that exist on our server
// Each room has roomName, joinable, users, chatMessages
const rooms = [];
const roomTimeouts = [];
const roomIntervals = [];
let roomCount = 0; // Number of rooms created since the server started

const createNewRoom = (numPlayers) => {
  roomCount++;
  const roomObj = {
    roomName: `Room${roomCount}`,
    joinable: true,
    running: false,
    users: {},
    neededPlayers: numPlayers,
    chatMessages: [],
  };

  rooms.push(roomObj);
  return rooms[rooms.indexOf(roomObj)];
};

const assignRoles = (r) => {
  const room = r;

  switch (room.neededPlayers) {
    case 4: room.roles = ['Werewolf', 'Villager', 'Villager', 'Villager', 'Seer', 'Robber', 'Insomniac'];
      break;
    case 5: room.roles = ['Werewolf', 'Werewolf', 'Villager', 'Villager', 'Seer', 'Robber', 'Insomniac', 'Tanner'];
      break;
    case 6: room.roles = ['Werewolf', 'Werewolf', 'Villager', 'Villager', 'Seer', 'Robber', 'Insomniac', 'Revealer', 'Tanner'];
      break;
    case 7: room.roles = ['Werewolf', 'Werewolf', 'Villager', 'Villager', 'Villager', 'Seer', 'Robber', 'Insomniac', 'Revealer', 'Tanner'];
      break;
    case 8: room.roles = ['Werewolf', 'Werewolf', 'Villager', 'Villager', 'Mason', 'Mason', 'Seer', 'Robber', 'Insomniac', 'Revealer', 'Tanner'];
      break;
    default: room.roles = [];
      break;
  }

  const availableRoles = room.roles.slice(0, room.roles.length);
  const { users } = room;
  const keys = Object.keys(users);
  room.usedRoles = [];

  // Give each user a role
  for (let i = 0; i < keys.length; i++) {
    const role = availableRoles[Math.floor(Math.random() * availableRoles.length)];
    users[keys[i]].startRole = role;
    users[keys[i]].role = role;
    room.usedRoles.push(role);
    availableRoles.splice(availableRoles.indexOf(role), 1);
    io.sockets.in(room.roomName).emit('setStartRole', { hash: keys[i], role });
  }

  // The 3 available roles become the 3 card roles
  room.cardRoles = availableRoles;

  io.sockets.in(room.roomName).emit('setUnusedRoles', { roles: room.cardRoles });
};

const getBestRoom = (neededPlayers) => {
  let bestRoom;
  let userCount = -1;

  // If there are no rooms, create one
  if (rooms.length === 0) {
    return createNewRoom(neededPlayers);
  }

  // Otherwise, we loop through our rooms and see if at least one is joinable
  let joinable = false;
  for (let i = 0; i < rooms.length; i++) {
    if (rooms[i].neededPlayers === neededPlayers && rooms[i].joinable) {
      joinable = true;
      break;
    }
  }

  // If no rooms are joinable, create a new room
  if (!joinable) return createNewRoom(neededPlayers);

  // Otherwise, we have at least one joinable room
  // Loop through our rooms and find the joinable room with the most users
  for (let i = 0; i < rooms.length; i++) {
    const checkRoom = rooms[i];
    if (checkRoom.neededPlayers === neededPlayers && checkRoom.joinable) {
      const keys = Object.keys(checkRoom.users);
      if (keys.length < neededPlayers && keys.length > userCount) {
        userCount = keys.length;
        bestRoom = checkRoom;
      }
    }
  }

  if (!bestRoom) return createNewRoom(neededPlayers);

  return bestRoom;
};

const getRoom = (rName) => {
  for (let i = 0; i < rooms.length; i++) {
    if (rooms[i].roomName === rName) return rooms[i];
  }
  return null;
};

// Function to decrease the timer by 1
const decreaseTimer = (r) => {
  const room = r;
  room.timer--;
  if (room.timer < 0) room.timer = 0;
  io.sockets.in(room.roomName).emit('setTimer', {
    time: room.timer,
  });
};


const findPlayers = (r, role) => {
  const room = r;
  const players = [];
  const { users } = room;
  const keys = Object.keys(users);
  for (let i = 0; i < keys.length; i++) {
    if (users[keys[i]].startRole === role) players.push(users[keys[i]]);
  }

  return players;
};

const endGame = (r) => {
  const room = r;

  let tannerKilled = false;
  let werewolfKilled = false;
  for (let i = 0; i < room.votedPlayers.length; i++) {
    const player = room.users[room.votedPlayers[i]];

    // Check if a Tanner or a Werewolf was killed
    if (player.role === 'Tanner') {
      tannerKilled = true;
    }
    if (player.role === 'Werewolf') {
      werewolfKilled = true;
    }
  }

  if (tannerKilled) {
    // Tanner wins if tanner was killed
    io.sockets.in(room.roomName).emit('addMessage', 'Server: The Tanner has died. The Tanner wins!');
  } else if (!werewolfKilled && room.usedRoles.includes('Werewolf')) {
    // Werewolves win if a werewolf was not killed, and there was a werewolf in the game
    // Werewolves lose if Tanner dies, so this is an else if
    io.sockets.in(room.roomName).emit('addMessage', 'Server: All werewolves survived. The werewolevs win!');
  }
  if (werewolfKilled) {
    // Villagers win if a werewolf is killed
    // Both Villagers and Tanner can win a game together
    io.sockets.in(room.roomName).emit('addMessage', 'Server: A werewolf was killed. The villagers win!');
  }

  if (room.votedPlayers.length === 0 && !room.usedRoles.includes('Werewolf')) {
    // If no players died and no werewolves were in the game, the villagers win
    io.sockets.in(room.roomName).emit('addMessage', 'Server: No werewolves were present in the game, and no players were killed. The villagers win!');
  } else if (room.votedPlayers.length > 0 && !room.usedRoles.includes('Werewolf')) {
    io.sockets.in(room.roomName).emit('addMessage', 'Server: No werewolves were present in the game, but a player was killed. The villagers lose!');
  }

  io.sockets.in(room.roomName).emit('screenMessage', { message: 'Game Over!', submessage: 'Please reconnect to play again', disappear: true });
};

const killPlayers = (r) => {
  const room = r;
  const killedPlayer = room.users[room.votedPlayers[room.killCount]];

  io.sockets.in(room.roomName).emit('screenMessage', { message: `${killedPlayer.name} has been killed!`, submessage: `${killedPlayer.name} was a ${killedPlayer.role}`, disappear: true });

  room.killCount++;
  if (room.killCount < room.votedPlayers.length) {
    // If there are more players to kill, we kill them
    setTimeout(() => {
      killPlayers(room);
    }, 5000);
  } else {
    // Otherwise, we end the game
    setTimeout(() => {
      endGame(room);
    }, 5000);
  }
};

const tallyVotes = (r) => {
  const room = r;

  const voteCounts = {};

  for (let i = 0; i < room.votes.length; i++) {
    voteCounts[room.votes[i]] = (voteCounts[room.votes[i]] || 0) + 1;
  }

  const keys = Object.keys(voteCounts);
  let numVotes = 2;
  const votedPlayers = [];

  for (let i = 0; i < keys.length; i++) {
    if (voteCounts[keys[i]] === numVotes) {
      // If this player has the number of votes we are looking for, add them
      votedPlayers.push(keys[i]);
    } else if (voteCounts[keys[i]] > numVotes) {
      // If the player has more votes, clear our list, updated our numVotes, and add the player
      numVotes = voteCounts[keys[i]];
      votedPlayers.length = 0;
      votedPlayers.push(keys[i]);
    }
  }

  room.votedPlayers = votedPlayers;
  room.killCount = 0;
  if (room.votedPlayers.length > 0) {
    killPlayers(room);
  } else {
    endGame(room);
  }
};

const handleVoting = (r) => {
  const room = r;
  room.votes = [];
  room.timer = 10;

  io.sockets.in(room.roomName).emit('screenMessage', { message: 'Vote for who you would like to kill!', submessage: 'Player(s) with the most votes will be killed (with at least 2 votes).' });
  io.sockets.in(room.roomName).emit('canVote');

  roomTimeouts[rooms.indexOf(room)] = setTimeout(() => {
    tallyVotes(room);
  }, 10000);
};

const handleRoleActions = (r) => {
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
        // Have the socket emit a flip for all werewolves
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
    if (roles.includes('Mason')) {
      foundPlayers = findPlayers(room, 'Mason');
      if (foundPlayers.length > 0) {
        // Have the socket emit a flip for all masons
        for (let i = 0; i < foundPlayers.length; i++) {
          io.to(foundPlayers[i].socketID).emit('wake');
          io.to(foundPlayers[i].socketID).emit('screenMessage', { message: 'Masons, wake up!', submessage: 'Take a look at your other masons.' });
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

  if (room.actionCount === 2) {
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

  if (room.actionCount === 3) {
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

  if (room.actionCount === 4) {
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

  if (room.actionCount === 5) {
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

  if (room.actionCount === 6) {
    clearTimeout(roomTimeouts[roomIndex]);
    io.sockets.in(room.roomName).emit('day');
    io.sockets.in(room.roomName).emit('wake');
    io.sockets.in(room.roomName).emit('screenMessage', { message: 'Everyone wake up!', submessage: 'You have 3 minutes to discuss before voting.', disappear: true });
    roomTimeouts[roomIndex] = setTimeout(() => {
      handleVoting(room);
    }, 180000);
    room.timer = 180;
  }
};

const startGame = (r) => {
  const room = r;

  assignRoles(room);

  room.timer = 10;
  room.actionCount = 0;
  io.sockets.in(room.roomName).emit('screenMessage', { message: 'All players have been given their roles!', submessage: 'You have 10 seconds before you fall asleep.', disappear: true });
  io.sockets.in(room.roomName).emit('setTokens', { tokens: room.roles });
  const { users } = room;
  const keys = Object.keys(users);
  for (let i = 0; i < keys.length; i++) {
    io.to(users[keys[i]].socketID).emit('flip', { hash: users[keys[i]].hash, flipped: true });
  }

  const roomIndex = rooms.indexOf(room);
  roomIntervals[roomIndex] = setInterval(() => {
    decreaseTimer(room);
  }, 1000);
  clearTimeout(roomTimeouts[roomIndex]);
  roomTimeouts[roomIndex] = setTimeout(() => {
    io.sockets.in(room.roomName).emit('night');
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
    const room = getBestRoom(data.playerSize);

    socket.join(room.roomName);

    // Server itself doesn't care about height, width, prevX, and prevY (unless collisions)
    socket.hash = xxh.h32(`${socket.id}${new Date().getTime()}`, 0xDEADBEEF).toString(16);

    room.users[socket.hash] = { name: data.name, socketID: socket.id, hash: socket.hash };

    // Start the game when the room hits its neededPlayers players
    io.sockets.in(room.roomName).emit('screenMessage', { message: `${data.name} has joined!`, submessage: `${room.neededPlayers - Object.keys(room.users).length} more players needed to start the game`, disappear: true });

    socket.roomName = room.roomName;

    socket.emit('joined', {
      name: data.name,
      roomName: socket.roomName,
      hash: socket.hash,
      socketID: socket.id,
    });

    socket.emit('setPlayers', { players: room.users });

    socket.broadcast.to(room.roomName).emit('addPlayer', { name: data.name, hash: socket.hash });

    if (Object.keys(room.users).length === room.neededPlayers) {
      console.dir(`Starting game for ${room.roomName}`);
      startGame(room);
    }
  });
};

io.on('connection', (sock) => {
  const socket = sock;

  onJoined(socket);

  socket.on('disconnect', () => {
    io.sockets.in(socket.roomName).emit('left', socket.hash);

    const room = getRoom(socket.roomName);
    if (room) delete room.users[socket.hash];

    socket.leave(socket.roomName);
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

  socket.on('vote', (data) => {
    const room = getRoom(data.roomName);
    room.votes.push(data.hash);
  });
});

const getUsers = rName => getRoom(rName).users;

console.log(`listening on port ${PORT}`);

module.exports.getUsers = getUsers;
module.exports.rooms = rooms;
