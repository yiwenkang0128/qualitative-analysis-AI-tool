# Anti-Displacement Reader
Anti-Displacement Reader is a full-stack, AI-powered platform designed for intelligent PDF analysis and interactive document querying. Users can upload PDF documents, from which the system automatically extracts core topics and generates summaries. It features a chat interface for in-depth Q&A with the document, along with a robust user management system including Administrator and User roles.


## Tech Stack
- **Frontend:** React, Tailwind CSS v4, Vite

- **Backend:** Node.js (Express), Python (BERTopic for topic modeling)

- **Database:** PostgreSQL, Prisma ORM

- **AI Models:** OpenAI API, BERTopic

- **Authentication:** JWT (Cookie-based HttpOnly), bcryptjs

## Prerequisites
Before you begin, ensure you have the following installed on your machine:

- Node.js (v20 LTS or higher recommended)

- Python (v3.10 or v3.11 recommended; avoid 3.12+ for compatibility with some ML libraries)

- PostgreSQL (v14 or higher)

## Setup Guide

1. Create the Database
```
createdb anti_displacement_db
```

2. Install dependencies
```
cd backend
npm install
```
3. Create .env under the backend folder
```
OPENAI_API_KEY = YOUR_API_KEY

# PostgreSQL Connection String
# Format: postgresql://USER:PASSWORD@localhost:5432/DB_NAME?schema=public
# Note: Replace 'your_username' with your system username. Leave password empty if not set.
DATABASE_URL="postgresql://your_username:@localhost:5432/anti_displacement_db?schema=public"

# JWT Secret (Used for signing session cookies)
JWT_SECRET=your-super-secret-jwt-key-here
```

4. Setup Python Environment
```
# Create virtual environment
python3 -m venv venv

source venv/bin/activate

# Install Python dependencies
pip install openai scikit-learn pandas pdfplumber bertopic
```
5. Database Migration
```
npx prisma migrate dev --name init
```
6. Run
- cd backend
```
node server.js
```
- cd frontend
```
npm install
npm run dev
```