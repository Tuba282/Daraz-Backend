const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Product = require('./models/Product');
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  
  const productsToUpdate = await Product.find().limit(6);
  const ids = productsToUpdate.map(p => p._id);
  
  await Product.updateMany(
    { _id: { $in: ids } }, 
    { isFlashSale: true, flashSaleEndsAt: futureDate }
  );
  
  console.log('Successfully set Flash Sales');
  process.exit(0);
}).catch(console.error);
