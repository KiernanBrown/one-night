const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

let PlayerModel = {};

const PlayerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },

  gamesPlayed: {
    type: Number,
    min: 0,
    required: true,
  },

  wins: {
    type: Number,
    min: 0,
    required: true,
  },
});

PlayerSchema.statics.findByName = (name, callback) => {
  const search = {
    name,
  };

  return PlayerModel.findOne(search, callback);
};

PlayerModel = mongoose.model('Player', PlayerSchema);

module.exports.PlayerModel = PlayerModel;
module.exports.PlayerSchmea = PlayerSchema;
