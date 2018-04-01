const Victor = require('victor');
const app = require('./app.js');

const slashes = {};
// const enemyProjectiles = [];

// Check collisions of two boxes
/* const checkBoxCollisions = (rect1, rect2, width, height) => {
  if (rect1.x < rect2.x + width &&
    rect1.x + width > rect2.x &&
    rect1.y < rect2.y + height &&
    height + rect1.y > rect2.y) {
    return true; // Is colliding
  }
  return false; // Is not colliding
}; */

const checkPointCollision = (rect, point) => {
  if (point.x > rect.x && point.x < rect.x + rect.width) {
    if (point.y > rect.y && point.y < rect.y + rect.height) {
      return true;
    }
  }
  return false;
};

const checkSlashCollision = (enemy, slashObj) => {
  const slash = slashObj;

  // Check if this enemy has already been hit by the slash
  if (slash.hits.includes(enemy.hash)) {
    return false;
  }

  const collisionPoint = new Victor(slash.p2X, slash.p2Y);

  // If our collisionPoint is in our enemy, then the slash has connected
  return checkPointCollision(enemy, collisionPoint);
};

// Function to check what enemies each slash is hitting
const checkSlashes = () => {
  const keys = Object.keys(slashes);
  if (keys.length > 0) {
    for (let i = 0; i < keys.length; i++) {
      const slash = slashes[keys[i]];
      if (slash.alpha > 0) {
        const enemies = app.getEnemies(slash.roomName);

        // Loop through our enemies and check if they are being hit by this slash
        for (let j = 0; j < enemies.length; j++) {
          const enemy = enemies[j];

          const hit = checkSlashCollision(enemy, slash);

          // If the enemy is being hit, we add it to the slash's hits and hit the enemy
          if (hit) {
            slash.hits.push(enemy.hash);
            app.enemyHit({ enemy, slash });
          }
        }
      }
    }
  }
};

// Check for collisions every 20ms
setInterval(() => {
  checkSlashes();
}, 20);

const addSlash = (slash) => {
  slashes[slash.hash] = slash;
};

module.exports.addSlash = addSlash;
