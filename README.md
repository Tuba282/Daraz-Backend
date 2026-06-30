# 🛒 Daraz Clone — Multi-Vendor eCommerce Marketplace

A full-stack Daraz-inspired marketplace built with React (Vite), Tailwind CSS, Node.js, Express.js, and MongoDB.

## 👥 User Roles
- **Admin** — Platform management, approvals, analytics
- **Vendor** — Store, product, inventory, and order management
- **Customer** — Shop, cart, checkout, orders, reviews

## 🚀 Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite) + Tailwind CSS + Redux Toolkit |
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT (access + refresh tokens) |
| Payments | Stripe + Cash on Delivery |
| Storage | Cloudinary |
| Email | Nodemailer |

## 📁 Project Structure
```
DARAZ/
├── backend/    # Express REST API
└── frontend/   # React + Vite SPA
```

## ⚡ Quick Start

### Backend
```bash
cd backend
npm install
cp .env.example .env   # Fill in your secrets
npm run dev
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## 🌐 Environment Variables
See `backend/.env.example` and `frontend/.env.example` for required variables.

## 📄 License
MIT — For learning and portfolio purposes.
