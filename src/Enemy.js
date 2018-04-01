class Enemy {
  constructor(hash, maxX, maxY, health, playerList) {
    // Filter the list of all players to only alive players
    const players = [];
    const keys = Object.keys(playerList);
    for (let i = 0; i < keys.length; i++) {
      if (playerList[keys[i]].alive) players.push(playerList[keys[i]]);
    }
    this.hash = hash;
    this.lastUpdate = new Date().getTime();
    this.setXY(maxX, maxY, players);
    this.height = 32;
    this.width = 32;
    this.prevX = this.x;
    this.prevY = this.y;
    this.destX = this.x;
    this.destY = this.y;
    this.alpha = 0;
    this.health = health;
    this.alive = true;
    this.target = null;
    this.setTarget(players);
  }

  setXY(maxX, maxY, playerList) {
    let goodPosition = true;
    do {
      goodPosition = true;
      this.x = Math.floor(Math.random() * maxX);
      this.y = Math.floor(Math.random() * maxY);
      for (let i = 0; i < playerList.length; i++) {
        const player = playerList[i];
        if (Math.abs(this.x - player.x) < 60 || Math.abs(this.y - player.y) < 60) {
          goodPosition = false;
          break;
        }
      }
    } while (!goodPosition);
  }

  setTarget(playerList) {
    this.target = playerList[Math.floor(Math.random() * playerList.length)];
  }
}

module.exports = Enemy;
