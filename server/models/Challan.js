const mongoose = require('mongoose');

const ChallanItemSchema = new mongoose.Schema({
  srNo: { type: Number, required: true },
  itemName: { type: String, required: true },
  size: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 1 },
  unit: { type: String, default: '' },
  remark: { type: String, default: '' },
  returnedQty: { type: Number, default: 0 },
  lossOrDamageQty: { type: Number, default: 0 }
});

const ChallanSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  clientName: { type: String, required: true },
  venue: { type: String, required: true },
  dispatchDate: { type: String, required: true },
  dueDate: { type: String, required: true },
  dispatcherName: { type: String, required: true },
  receiverName: { type: String, default: 'Site Representative' },
  status: {
    type: String,
    enum: ['At Site', 'Partially Returned', 'Fully Returned', 'Overdue'],
    default: 'At Site'
  },
  totalItemsCount: { type: Number, required: true },
  items: [ChallanItemSchema],
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Challan', ChallanSchema);
