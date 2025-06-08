# CommissionZero - Professional Services Marketplace

CommissionZero is a platform that connects customers with skilled contractors and freelancers for various services like solar installation, electrical work, carpentry, plumbing, and painting.

## Features

- User registration and authentication (customers, contractors, and freelancers)
- Service provider listings with ratings and portfolio
- Real-time chat between users and service providers
- Contact management system
- Portfolio showcase for service providers
- Calendar integration for scheduling

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MySQL
- Authentication: JWT (JSON Web Tokens)

## Prerequisites

- Node.js (v14 or higher)
- MySQL (v8 or higher)
- npm (Node Package Manager)

## Setup Instructions

1. Clone the repository:
```bash
git clone <repository-url>
cd commissionzero
```

2. Install dependencies:
```bash
npm install
```

3. Create a MySQL database:
```sql
CREATE DATABASE commissionzero_db;
```

4. Create a `.env` file in the root directory with the following content:
```
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=commissionzero_db
JWT_SECRET=your_jwt_secret_key
PORT=3000
```

5. Start the server:
```bash
node server.js
```

6. Open your browser and navigate to:
```
http://localhost:3000
```

## Database Schema

The application uses the following database tables:

- users
- service_providers
- portfolio_images
- messages

## API Endpoints

### Authentication
- POST /api/register - Register a new user
- POST /api/login - User login

### Service Providers
- GET /api/providers/:serviceType - Get service providers by type

### Messages
- POST /api/messages - Send a message
- GET /api/messages/:otherUserId - Get chat history

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License. 