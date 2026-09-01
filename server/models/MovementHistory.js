const mongoose = require('mongoose');

const MovementHistorySchema = new mongoose.Schema({
  id: { type: String, required: true },
  date: { type: String, required: true },
  itemName: { type: String, required: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  qty: { type: Number, required: true },
  type: {
    type: String,
    enum: ['Dispatch', 'Return', 'Damage'],
    required: true
  },
  operator: { type: String, default: '' },
  refId: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MovementHistory', MovementHistorySchema);
