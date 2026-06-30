const multer = require('multer');
const path = require('path');
const cloudinary = require('../config/cloudinary');
const ErrorResponse = require('../utils/errorResponse');

// Allowed file types
const allowedImageTypes = /jpeg|jpg|png|gif|webp/;

// Filter files
const fileFilter = (req, file, cb) => {
  const extname = allowedImageTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedImageTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new ErrorResponse('Only image files are allowed (jpeg, jpg, png, gif, webp)', 400));
};

// Store in memory buffer (for Cloudinary upload)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter,
});

// Upload buffer to Cloudinary
const uploadToCloudinary = (buffer, folder, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `daraz-clone/${folder}`,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        ...options,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

// Delete from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error);
  }
};

module.exports = { upload, uploadToCloudinary, deleteFromCloudinary };
