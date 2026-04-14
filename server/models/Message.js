const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  sender: String,
  receiver: String,
  text: String,
  sentiment: String,
  fileUrl: String,
  fileType: { type: String, enum: ['image','video','audio','file',null], default: null },
  fileName: String,
  replyTo: { _id: String, sender: String, text: String, fileType: String },
  reactions: [{ username: String, emoji: String }],
  seenAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', schema);
