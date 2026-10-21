# Chatbot AI Portal

## About the Project
Chatbot AI Portal is an AI-powered web application that allows users to upload documents and interact with their content through a chatbot. It also includes user authentication, document management, an admin dashboard, and HTML generation features.

## Features
- User Registration and Login
- AI Chatbot for document-based questions
- Single and Multiple Document Upload
- Support for PDF, DOCX, TXT, MD, HTML, CSV, and JSON files
- Hindi, Hinglish, and English question support
- Admin Dashboard
- HTML Generator
- Backend API integration
- Supabase PostgreSQL database integration

## Technologies Used
Mern Stack 
**Frontend**
- React.js
- Vite
- HTML and CSS,typesrcipt

**Backend**
- Node.js
- Express.js

**Database**
- Supabase PostgreSQL

**AI Integration**
- Rag
- Ollama (local AI model integration)
- 
## Prerequisites
- Node.js and npm
- Supabase account and database configuration
- Ollama installed locally if required by the AI features
  
### Backend Libraries and Packages
- **Multer** – Handles single and multiple file uploads.
- **JWT (jsonwebtoken)** – Supports token-based authentication and authorization.
- **bcrypt / bcryptjs** – Hashes user passwords before storing them.
- **pdf-parse** – Extracts text from PDF documents.
- **Mammoth** – Extracts text from DOCX documents.
- **dotenv** – Loads environment variables from configuration files.
- **CORS** – Enables cross-origin requests between the frontend and backend.

### 2. Install dependencies

```bash
npm install
cd client
npm install
cd ../server
npm install
```

### 3. Configure environment variables

Create the required `.env` file in the server directory and configure your Supabase database connection and other required settings.

Do not upload passwords, API keys, database credentials, or other secrets to GitHub.

### 4. Run the application

Start the backend and frontend in separate terminals using the scripts configured in their respective `package.json` files.

Frontend: `http://localhost:5173`

Backend: `http://localhost:5000`

## Project Status
Under Development

## Author
Nitin Tripathi
