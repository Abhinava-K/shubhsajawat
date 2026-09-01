const mongoose = require('mongoose');

const CatalogItemSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, default: 'General' },
  sizes: [{ type: String }],
  totalStock: { type: Number, default: 0, min: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CatalogItem', CatalogItemSchema);
