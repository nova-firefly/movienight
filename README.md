# MovieNight

A full-stack movie suggestion application built with React, GraphQL, Apollo Server, and PostgreSQL.

## Architecture

- **Frontend**: React + TypeScript + Apollo Client
- **Backend**: Node.js + Apollo Server + GraphQL
- **Database**: PostgreSQL
- **Containerization**: Docker + Docker Compose

## Getting Started

### Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local development)

### Quick Start with Docker

1. **Start all services:**

   ```bash
   docker-compose up -d
   ```

2. **Access the application:**
   - Frontend: http://localhost:3000
   - GraphQL Playground: http://localhost:4000/graphql
   - Database: localhost:5432

3. **Stop all services:**
   ```bash
   docker-compose down
   ```

### Local Development (without Docker)

1. **Install frontend dependencies:**

   ```bash
   npm install
   ```

2. **Install backend dependencies:**

   ```bash
   cd backend
   npm install
   cd ..
   ```

3. **Set up environment variables:**

   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   ```

4. **Start PostgreSQL** (you'll need a running PostgreSQL instance)

5. **Start the backend:**

   ```bash
   cd backend
   npm run dev
   ```

6. **Start the frontend (in a new terminal):**
   ```bash
   npm start
   ```

## GraphQL API

### Queries

- `movies`: Get all movies
- `movie(id: ID!)`: Get a specific movie by ID

### Mutations

- `addMovie(title: String!, requester: String!)`: Add a new movie suggestion
- `deleteMovie(id: ID!)`: Delete a movie by ID

### Example Queries

**Get all movies:**

```graphql
query {
  movies {
    id
    title
    requester
    date_submitted
  }
}
```

**Add a movie:**

```graphql
mutation {
  addMovie(title: "Inception", requester: "John") {
    id
    title
    requester
    date_submitted
  }
}
```

## Project Structure

```
movienight/
├── backend/                 # GraphQL backend server
│   ├── src/
│   │   ├── index.ts        # Server entry point
│   │   ├── schema.ts       # GraphQL schema definitions
│   │   ├── resolvers.ts    # GraphQL resolvers
│   │   └── db.ts           # Database connection
│   ├── Dockerfile
│   └── package.json
├── src/                     # React frontend
│   ├── components/
│   ├── graphql/
│   │   ├── client.ts       # Apollo Client setup
│   │   └── queries.ts      # GraphQL queries/mutations
│   └── ...
├── docker-compose.yml       # Docker orchestration
└── package.json
```

## Environment Variables

### Frontend (.env)

- `REACT_APP_GRAPHQL_URL`: GraphQL server URL (default: http://localhost:4000/graphql)

### Backend (backend/.env)

- `DB_HOST`: PostgreSQL host (default: db)
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name (default: movienight)
- `DB_USER`: Database user (default: movienight_user)
- `DB_PASSWORD`: Database password (default: movienight_pass)
- `PORT`: Backend server port (default: 4000)

## Docker Services

- **db**: PostgreSQL 15 database with persistent volume
- **backend**: GraphQL API server
- **frontend**: React development server

## Development

The application uses hot-reloading for both frontend and backend during development. Any changes you make will automatically reflect in the running application.

## Available Scripts (Create React App)

### `npm start`

Runs the app in development mode at http://localhost:3000

### `npm test`

Launches the test runner in interactive watch mode

### `npm run build`

Builds the app for production to the `build` folder

## Migration from Firebase

This application was migrated from Firebase Realtime Database to a self-hosted GraphQL + PostgreSQL stack, providing:

- Full control over data and infrastructure
- Better type safety with GraphQL
- Relational data capabilities
- Containerized deployment
