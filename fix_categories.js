const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  const productsCol = db.collection('products');
  const categoriesCol = db.collection('categories');

  // Get or create categories
  const catNames = [
    'Electronics', 'Fashion', 'Home & Kitchen', 'Sports & Fitness',
    'Beauty & Personal Care', 'Books & Stationery', 'Toys & Games', 'Groceries'
  ];

  const catDocs = [];
  for (const name of catNames) {
    let cat = await categoriesCol.findOne({ name });
    if (!cat) {
      const result = await categoriesCol.insertOne({
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      catDocs.push({ _id: result.insertedId, name });
    } else {
      catDocs.push(cat);
    }
  }
  console.log('Categories ready:', catDocs.map(c => c.name));

  // Assign categories to all products & mark first 6 as flash sale
  const products = await productsCol.find({}).toArray();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const catIndex = i % catDocs.length;
    const isFlashSale = i < 6; // first 6 are flash sale

    await productsCol.updateOne(
      { _id: p._id },
      {
        $set: {
          category: catDocs[catIndex]._id,
          isFlashSale,
          flashSaleEndsAt: isFlashSale ? futureDate : null,
        }
      }
    );
    console.log(`${p.name} → cat: ${catDocs[catIndex].name} | flashSale: ${isFlashSale}`);
  }

  console.log('\nAll done!');
  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
