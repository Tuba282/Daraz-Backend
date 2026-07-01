const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  const r = await db.collection('categories').updateMany({}, { $set: { isActive: true } });
  console.log('Updated:', r.modifiedCount, 'categories with isActive:true');
  
  // Verify
  const cats = await db.collection('categories').find().toArray();
  cats.forEach(c => console.log(c._id, c.name, '| isActive:', c.isActive));
  
  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
