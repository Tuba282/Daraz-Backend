const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateProfile,
  updateAvatar,
  addAddress,
  updateAddress,
  deleteAddress,
  toggleUserStatus,
  deleteUser,
} = require("../controllers/userController");
const { protect, authorize } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

// Customer routes
router.put("/profile", protect, updateProfile); //ok
router.put("/avatar", protect, upload.single("avatar"), updateAvatar); //ok
router.post("/addresses", protect, addAddress); //ok
router.put("/addresses/:addressId", protect, updateAddress); //ok
router.delete("/addresses/:addressId", protect, deleteAddress); //ok

// Admin routes
router.get("/", protect, authorize("admin"), getAllUsers); //ok
router.get("/:id", protect, authorize("admin"), getUserById); //ok
router.put("/:id/status", protect, authorize("admin"), toggleUserStatus); //ok
router.delete("/:id", protect, authorize("admin"), deleteUser); //ok

module.exports = router;
