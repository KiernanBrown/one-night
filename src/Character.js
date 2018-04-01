class Character {
  constructor(name, hash) {
    this.name = name;
    this.hash = hash;
    this.lastUpdate = new Date().getTime();
    this.x = 100;
    this.y = 100;
    this.height = 40;
    this.width = 40;
    this.prevX = 100;
    this.prevY = 100;
    this.destX = 100;
    this.destY = 100;
    this.alpha = 0;
    this.angle = 0;
    this.mouseX = 0;
    this.mouseY = 0;
    this.slashCooldown = 0;
    this.alive = true;
    this.score = 0;
  }
}

module.exports = Character;
