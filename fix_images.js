const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  const collection = db.collection('products');

  const products = await collection.find({}).toArray();
  let fixed = 0;

  for (const product of products) {
    if (!product.images || product.images.length === 0) continue;

    const newImages = product.images.map(img => {
      // Already correct format (has url field)
      if (img && img.url && typeof img.url === 'string') {
        return img;
      }

      // Character-indexed object (corrupted string) - reconstruct the URL
      if (img && typeof img === 'object' && img['0'] !== undefined) {
        const keys = Object.keys(img).filter(k => !isNaN(parseInt(k))).sort((a, b) => parseInt(a) - parseInt(b));
        const url = keys.map(k => img[k]).join('');
        console.log(`  Reconstructed URL: ${url}`);
        return { url, public_id: '', alt: '' };
      }

      // Plain string
      if (typeof img === 'string') {
        return { url: img, public_id: '', alt: '' };
      }

      return img;
    });

    await collection.updateOne(
      { _id: product._id },
      { $set: { images: newImages } }
    );
    fixed++;
    console.log(`Fixed: ${product.name}`);
  }

  console.log(`\nTotal fixed: ${fixed} products`);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
