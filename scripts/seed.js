const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Category = require('../models/Category');
const Product = require('../models/Product');

// Load environment variables
dotenv.config();

let dbUri = process.env.MONGO_URI;
if (!dbUri || dbUri.includes('<username>') || dbUri.includes('<password>')) {
  console.log('⚠️  MONGO_URI in .env is a placeholder or not set. Falling back to local MongoDB: mongodb://127.0.0.1:27017/daraz-clone');
  dbUri = 'mongodb://127.0.0.1:27017/daraz-clone';
}

const seedData = async () => {
  try {
    console.log('⏳ Connecting to database...');
    await mongoose.connect(dbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB.');

    // Clear existing data
    console.log('🧹 Clearing existing collections...');
    await User.deleteMany({});
    await Vendor.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    console.log('🧹 Cleared all collections.');

    // 1. Create Users
    console.log('👤 Seeding Users...');
    
    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@daraz.com',
      password: 'Password123',
      role: 'admin',
      isEmailVerified: true,
    });

    const vendorUser = await User.create({
      name: 'Daraz Store Owner',
      email: 'vendor@daraz.com',
      password: 'Password123',
      role: 'vendor',
      isEmailVerified: true,
    });

    const customerUser = await User.create({
      name: 'John Customer',
      email: 'customer@daraz.com',
      password: 'Password123',
      role: 'customer',
      isEmailVerified: true,
    });

    console.log('✅ Users seeded successfully.');

    // 2. Create Vendor Store
    console.log('🏪 Seeding Vendor Store...');
    const vendorStore = await Vendor.create({
      owner: vendorUser._id,
      storeName: 'Daraz Official Plaza',
      description: 'The official marketplace plaza for authentic electronics, fashion, and home lifestyle goods.',
      contactEmail: 'vendor@daraz.com',
      contactPhone: '03001234567',
      address: {
        city: 'Karachi',
        state: 'Sindh',
        country: 'Pakistan',
      },
      status: 'approved',
      rating: { average: 4.8, count: 15 },
      isActive: true,
      approvedAt: new Date(),
      approvedBy: adminUser._id,
    });
    console.log(`✅ Vendor store created: ${vendorStore.storeName}`);

    // 3. Create Categories
    console.log('🗂️  Seeding Categories...');
    
    const categoryData = [
      {
        name: 'Electronic Devices',
        sub: ['Smart Phones', 'Laptops', 'Tablets'],
      },
      {
        name: 'Electronic Accessories',
        sub: ['Mobile Accessories', 'Headphones', 'Smart Watches'],
      },
      {
        name: 'TV & Home Appliances',
        sub: ['Smart TVs', 'Refrigerators', 'Air Conditioners'],
      },
      {
        name: 'Health & Beauty',
        sub: ['Skin Care', 'Fragrances', 'Makeup'],
      },
      {
        name: 'Groceries',
        sub: ['Beverages', 'Snacks', 'Cooking Essentials'],
      },
      {
        name: 'Home & Lifestyle',
        sub: ['Bedding', 'Kitchen & Dining', 'Furniture'],
      },
      {
        name: 'Men\'s Fashion',
        sub: ['T-Shirts', 'Jeans', 'Watches'],
      },
      {
        name: 'Women\'s Fashion',
        sub: ['Traditional Wear', 'Western Wear', 'Bags'],
      },
    ];

    const categoryMap = {}; // mapping sub-cat names to their object IDs

    let order = 1;
    for (const cat of categoryData) {
      const parentCat = await Category.create({
        name: cat.name,
        description: `Premium items under ${cat.name}`,
        order: order++,
        isActive: true,
      });
      
      categoryMap[cat.name] = { id: parentCat._id, subs: {} };

      for (const subName of cat.sub) {
        const subCat = await Category.create({
          name: subName,
          parent: parentCat._id,
          description: `Best deals on ${subName}`,
          isActive: true,
        });
        categoryMap[cat.name].subs[subName] = subCat._id;
      }
    }
    console.log('✅ Categories and sub-categories seeded.');

    // 4. Create Products
    console.log('🛍️  Seeding Products...');
    
    const productsToSeed = [
      // Electronics
      {
        name: 'Samsung Galaxy S24 Ultra 5G (12GB RAM, 512GB)',
        description: 'Experience premium performance and AI capabilities with the new Galaxy S24 Ultra. Equipped with 200MP camera, Snapdragon 8 Gen 3, and dynamic AMOLED 2X screen.',
        brand: 'Samsung',
        price: 399000,
        salePrice: 359000,
        stock: 15,
        category: categoryMap['Electronic Devices'].id,
        subCategory: categoryMap['Electronic Devices'].subs['Smart Phones'],
        images: [{ url: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500&q=80', alt: 'Samsung S24 Ultra' }],
        sku: 'SAM-S24U-512',
        isFeatured: true,
        isFlashSale: true,
        flashSaleEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        rating: { average: 4.9, count: 42 },
        specifications: [
          { key: 'RAM', value: '12 GB' },
          { key: 'Storage', value: '512 GB' },
          { key: 'Camera', value: '200 MP + 50 MP + 12 MP + 10 MP' },
          { key: 'Battery', value: '5000 mAh' },
        ],
      },
      {
        name: 'Apple iPhone 15 Pro Max (256GB, Titanium)',
        description: 'Forged in titanium, featuring the groundbreaking A17 Pro chip, a customizable Action button, and the most powerful iPhone camera system ever.',
        brand: 'Apple',
        price: 450000,
        salePrice: 429000,
        stock: 8,
        category: categoryMap['Electronic Devices'].id,
        subCategory: categoryMap['Electronic Devices'].subs['Smart Phones'],
        images: [{ url: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500&q=80', alt: 'iPhone 15 Pro Max' }],
        sku: 'APL-IP15PM-256',
        isFeatured: true,
        rating: { average: 4.8, count: 28 },
        specifications: [
          { key: 'RAM', value: '8 GB' },
          { key: 'Storage', value: '256 GB' },
          { key: 'Chipset', value: 'A17 Pro' },
          { key: 'Weight', value: '221g' },
        ],
      },
      {
        name: 'ASUS ROG Zephyrus G14 Gaming Laptop',
        description: 'Compact gaming laptop with AMD Ryzen 9, NVIDIA RTX 4060, 16GB DDR5 RAM, and a stunning 14-inch ROG Nebula Display.',
        brand: 'ASUS',
        price: 360000,
        salePrice: 325000,
        stock: 5,
        category: categoryMap['Electronic Devices'].id,
        subCategory: categoryMap['Electronic Devices'].subs['Laptops'],
        images: [{ url: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=500&q=80', alt: 'ASUS Laptop' }],
        sku: 'ASU-ZEPH-G14',
        isFeatured: true,
        rating: { average: 4.7, count: 14 },
        specifications: [
          { key: 'Processor', value: 'AMD Ryzen 9 7940HS' },
          { key: 'Graphics', value: 'NVIDIA RTX 4060 8GB GDDR6' },
          { key: 'RAM', value: '16 GB DDR5' },
          { key: 'Storage', value: '1 TB PCIe NVMe SSD' },
        ],
      },

      // Electronic Accessories
      {
        name: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
        description: 'Industry leading noise cancelling headphones with premium sound, crystal clear hands-free calling, and 30-hour battery life.',
        brand: 'Sony',
        price: 95000,
        salePrice: 85000,
        stock: 20,
        category: categoryMap['Electronic Accessories'].id,
        subCategory: categoryMap['Electronic Accessories'].subs['Headphones'],
        images: [{ url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80', alt: 'Sony WH-1000XM5' }],
        sku: 'SNY-WH1000XM5',
        isFeatured: true,
        isFlashSale: true,
        flashSaleEndsAt: new Date(Date.now() + 18 * 60 * 60 * 1000),
        rating: { average: 4.9, count: 67 },
        specifications: [
          { key: 'Battery Life', value: 'Up to 30 hours' },
          { key: 'Noise Cancellation', value: 'Dual Processor ANC' },
          { key: 'Connection', value: 'Bluetooth 5.2 & 3.5mm Jack' },
        ],
      },
      {
        name: 'Anker PowerCore 20,000mAh Power Bank',
        description: 'Ultra-high capacity power bank with PowerIQ technology for rapid charging of your smartphones, tablets, and accessories.',
        brand: 'Anker',
        price: 8500,
        salePrice: 6999,
        stock: 50,
        category: categoryMap['Electronic Accessories'].id,
        subCategory: categoryMap['Electronic Accessories'].subs['Mobile Accessories'],
        images: [{ url: 'https://images.unsplash.com/photo-1609592424083-d5d19d67b458?w=500&q=80', alt: 'Anker Powerbank' }],
        sku: 'ANK-PWRCR-20K',
        rating: { average: 4.6, count: 124 },
      },
      {
        name: 'Amazfit GTR 4 Smart Watch (AMOLED, GPS)',
        description: 'Premium smart watch with dual-band circular-polarized GPS, 150+ sports modes, 14-day battery life, and 24H heart rate monitoring.',
        brand: 'Amazfit',
        price: 45000,
        salePrice: 38500,
        stock: 12,
        category: categoryMap['Electronic Accessories'].id,
        subCategory: categoryMap['Electronic Accessories'].subs['Smart Watches'],
        images: [{ url: 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=500&q=80', alt: 'Amazfit Watch' }],
        sku: 'AMZ-GTR4',
        isFlashSale: true,
        flashSaleEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        rating: { average: 4.5, count: 19 },
      },

      // Home Appliances
      {
        name: 'TCL 55-inch 4K UHD Smart QLED TV',
        description: 'Bring cinematic visuals to your living room with TCL 4K QLED TV featuring Google TV, HDR10+, Dolby Vision, and Hands-free Voice Control.',
        brand: 'TCL',
        price: 135000,
        salePrice: 119999,
        stock: 7,
        category: categoryMap['TV & Home Appliances'].id,
        subCategory: categoryMap['TV & Home Appliances'].subs['Smart TVs'],
        images: [{ url: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=500&q=80', alt: 'TCL Smart TV' }],
        sku: 'TCL-55QLED-UHD',
        isFeatured: true,
        rating: { average: 4.6, count: 32 },
      },
      {
        name: 'Haier Inverter Air Conditioner 1.5 Ton',
        description: 'Smart Haier Inverter AC with Triple Inverter technology, 4-way cooling, self-cleaning mode, and up to 60% energy saving efficiency.',
        brand: 'Haier',
        price: 180000,
        salePrice: 168000,
        stock: 10,
        category: categoryMap['TV & Home Appliances'].id,
        subCategory: categoryMap['TV & Home Appliances'].subs['Air Conditioners'],
        images: [{ url: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&q=80', alt: 'Haier AC' }],
        sku: 'HAI-15INV-AC',
        rating: { average: 4.7, count: 48 },
      },

      // Beauty & Health
      {
        name: 'CeraVe Hydrating Facial Cleanser (236ml)',
        description: 'Developed with dermatologists, a gentle, non-foaming gel formula that cleanses and refreshes skin without over-stripping.',
        brand: 'CeraVe',
        price: 4800,
        salePrice: 3950,
        stock: 40,
        category: categoryMap['Health & Beauty'].id,
        subCategory: categoryMap['Health & Beauty'].subs['Skin Care'],
        images: [{ url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&q=80', alt: 'CeraVe Cleanser' }],
        sku: 'CRV-HYD-CLN',
        isFeatured: true,
        isFlashSale: true,
        flashSaleEndsAt: new Date(Date.now() + 20 * 60 * 60 * 1000),
        rating: { average: 4.8, count: 186 },
      },
      {
        name: 'Bleu de Chanel Eau De Parfum (100ml)',
        description: 'An ode to masculine freedom expressed in a woody aromatic fragrance with a captivating trail. A timeless scent housed in a deep and mysterious blue bottle.',
        brand: 'Chanel',
        price: 48000,
        salePrice: 42000,
        stock: 15,
        category: categoryMap['Health & Beauty'].id,
        subCategory: categoryMap['Health & Beauty'].subs['Fragrances'],
        images: [{ url: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=500&q=80', alt: 'Chanel Perfume' }],
        sku: 'CHL-BDC-100',
        isFeatured: true,
        rating: { average: 4.9, count: 54 },
      },

      // Groceries
      {
        name: 'Tapal Danedar Tea (950g Pack)',
        description: 'Pakistan\'s favorite cup of tea, Tapal Danedar has a strong flavor, rich color, and invigorating aroma.',
        brand: 'Tapal',
        price: 1650,
        salePrice: 1499,
        stock: 100,
        category: categoryMap['Groceries'].id,
        subCategory: categoryMap['Groceries'].subs['Beverages'],
        images: [{ url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&q=80', alt: 'Tapal Tea' }],
        sku: 'TAP-DND-950',
        rating: { average: 4.8, count: 320 },
      },
      {
        name: 'Dalda Premium Olive Oil 1 Litre',
        description: 'Pure Spanish Olive Oil, processed with modern refining methods to preserve nutrition and health benefits for premium cooking.',
        brand: 'Dalda',
        price: 2800,
        salePrice: 2450,
        stock: 60,
        category: categoryMap['Groceries'].id,
        subCategory: categoryMap['Groceries'].subs['Cooking Essentials'],
        images: [{ url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&q=80', alt: 'Olive Oil' }],
        sku: 'DLD-OLV-1L',
        isFlashSale: true,
        flashSaleEndsAt: new Date(Date.now() + 10 * 60 * 60 * 1000),
        rating: { average: 4.7, count: 76 },
      },

      // Home & Lifestyle
      {
        name: 'Luxury Cotton Double Bed Sheet Set',
        description: 'Premium quality double bed sheet made of 100% combed cotton, with 2 matching pillow cases in contemporary designs.',
        brand: 'ChenOne',
        price: 5500,
        salePrice: 4200,
        stock: 25,
        category: categoryMap['Home & Lifestyle'].id,
        subCategory: categoryMap['Home & Lifestyle'].subs['Bedding'],
        images: [{ url: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=500&q=80', alt: 'Bed Sheet' }],
        sku: 'CHN-Luxury-Cotton',
        rating: { average: 4.4, count: 35 },
      },

      // Men's Fashion
      {
        name: 'Pack of 3 Cotton Crewneck T-Shirts',
        description: 'Made of soft premium cotton, these comfortable casual crewneck t-shirts are excellent for summer wear.',
        brand: 'Outfitters',
        price: 3500,
        salePrice: 2499,
        stock: 45,
        category: categoryMap['Men\'s Fashion'].id,
        subCategory: categoryMap['Men\'s Fashion'].subs['T-Shirts'],
        images: [{ url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&q=80', alt: 'T-Shirts Pack' }],
        sku: 'OUTF-TEE-P3',
        isFlashSale: true,
        flashSaleEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        rating: { average: 4.2, count: 83 },
      },
      {
        name: 'Casio Vintage Digital Metal Watch',
        description: 'A classic vintage digital steel wrist watch for men with stopwatch, alarm, auto-calendar, and led backlight.',
        brand: 'Casio',
        price: 12500,
        salePrice: 9500,
        stock: 30,
        category: categoryMap['Men\'s Fashion'].id,
        subCategory: categoryMap['Men\'s Fashion'].subs['Watches'],
        images: [{ url: 'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=500&q=80', alt: 'Casio Watch' }],
        sku: 'CAS-VNT-DIG',
        isFeatured: true,
        rating: { average: 4.8, count: 104 },
      },

      // Women's Fashion
      {
        name: 'Embroidered Lawn 3-Piece Unstitched Suit',
        description: 'Beautiful unstitched lawn summer suit with detailed embroidery work on shirt, lawn trousers, and matching chiffon dupatta.',
        brand: 'Khaadi',
        price: 7500,
        salePrice: 5999,
        stock: 20,
        category: categoryMap['Women\'s Fashion'].id,
        subCategory: categoryMap['Women\'s Fashion'].subs['Traditional Wear'],
        images: [{ url: 'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?w=500&q=80', alt: 'Traditional Suit' }],
        sku: 'KHD-EL-3P',
        isFeatured: true,
        rating: { average: 4.6, count: 52 },
      },
      {
        name: 'Premium Leather Crossbody Handbag',
        description: 'Compact leather crossbody handbag for girls with adjustable strap, magnetic snap closure, and multiple card compartments.',
        brand: 'Limelight',
        price: 4200,
        salePrice: 3200,
        stock: 15,
        category: categoryMap['Women\'s Fashion'].id,
        subCategory: categoryMap['Women\'s Fashion'].subs['Bags'],
        images: [{ url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500&q=80', alt: 'Crossbody Bag' }],
        sku: 'LML-LEATHER-BAG',
        isFlashSale: true,
        flashSaleEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        rating: { average: 4.3, count: 17 },
      }
    ];

    for (const p of productsToSeed) {
      await Product.create({
        ...p,
        vendor: vendorStore._id,
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: adminUser._id,
      });
    }

    console.log(`✅ Seeded ${productsToSeed.length} products successfully.`);
    console.log('\n🌟 DATABASE SEEDING COMPLETED SUCCESSFULLY 🌟');
    console.log('─────────────────────────────────────────');
    console.log('Use the following credentials to log in:');
    console.log('ADMIN:    admin@daraz.com    | Password123');
    console.log('VENDOR:   vendor@daraz.com   | Password123');
    console.log('CUSTOMER: customer@daraz.com | Password123');
    console.log('─────────────────────────────────────────');
    
    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`❌ Seeding failed: ${error.message}`);
    console.error(error.stack);
    mongoose.connection.close();
    process.exit(1);
  }
};

seedData();
