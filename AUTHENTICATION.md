# Authentication System

This document describes the authentication system implemented in MovieNight.

## Overview

The MovieNight application now includes a complete authentication system with:
- Password-based login using JWT (JSON Web Tokens)
- Initial admin user with default credentials
- User management for admin users (create, edit, delete users)
- Protected routes and GraphQL resolvers
- Session persistence using localStorage

## Default Admin User

An admin user is automatically created on first startup with the following credentials:

- **Username**: `admin`
- **Password**: `admin123` (or the value of `ADMIN_PASSWORD` environment variable)

**⚠️ IMPORTANT**: Please change this password immediately after first login for security.

## Environment Variables

Add these to your `.env` file:

```env
# Authentication Configuration
JWT_SECRET=your-secret-key-change-in-production
ADMIN_PASSWORD=admin123
```

**Note**: In production, use a strong, randomly generated JWT_SECRET.

## Architecture

### Backend

#### Database Schema

A new `users` table has been added:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### GraphQL Schema

New types and mutations:

```graphql
type User {
  id: ID!
  username: String!
  email: String!
  is_admin: Boolean!
  created_at: String!
  updated_at: String!
}

type AuthPayload {
  token: String!
  user: User!
}

# Queries
me: User                    # Get current user (requires authentication)
users: [User!]!             # Get all users (admin only)
user(id: ID!): User         # Get user by ID (admin only)

# Mutations
login(username: String!, password: String!): AuthPayload!
createUser(username: String!, email: String!, password: String!, is_admin: Boolean): User!  # Admin only
updateUser(id: ID!, username: String, email: String, password: String, is_admin: Boolean): User!  # Admin only
deleteUser(id: ID!): Boolean!  # Admin only
```

#### Authentication Flow

1. **Login**: User submits username/password via `login` mutation
2. **Token Generation**: Server validates credentials and generates JWT token
3. **Token Storage**: Client stores token in localStorage
4. **Request Authentication**: Client includes token in Authorization header as `Bearer <token>`
5. **Context Creation**: Server verifies token and adds user info to GraphQL context
6. **Authorization**: Resolvers check context for authentication/authorization

#### Key Files

- `backend/src/models/User.ts` - User type definitions
- `backend/src/auth.ts` - JWT and password hashing utilities
- `backend/src/resolvers.ts` - Authentication and user management resolvers
- `backend/src/schema.ts` - GraphQL schema with auth types
- `backend/src/index.ts` - Apollo Server context configuration
- `backend/src/db.ts` - Database initialization and admin user seeding
- `backend/migrations/1737838100000_create-users-table.js` - Users table migration

### Frontend

#### Components

- `src/components/auth/Login.tsx` - Login page component
- `src/components/admin/UserManagement.tsx` - User management UI (admin only)
- `src/contexts/AuthContext.tsx` - Authentication state management
- `src/models/User.ts` - User type definitions

#### Authentication Flow

1. User lands on login page
2. After successful login, token is stored in localStorage
3. AuthProvider loads user data using the token
4. App.tsx conditionally renders based on authentication state
5. Authenticated users see the movie list
6. Admin users also see "Manage Users" option

#### Key Features

- Automatic session restoration on page reload
- Logout functionality that clears localStorage
- Protected routes (login required)
- Admin-only user management interface
- Real-time user feedback with loading states and error messages

## User Management (Admin Only)

Admin users can manage other users through the "Manage Users" interface:

### Create User
- Click "Add User" button
- Enter username, email, and password
- Optionally check "Is Admin" to grant admin privileges
- Click "Create"

### Edit User
- Click "Edit" button next to a user
- Update username, email, or admin status
- Optionally enter a new password (leave blank to keep current password)
- Click "Update"

### Delete User
- Click "Delete" button next to a user
- Confirm the deletion
- Note: Users cannot delete their own account

## Security Features

1. **Password Hashing**: Passwords are hashed using bcrypt with 10 salt rounds
2. **JWT Tokens**: Stateless authentication with 7-day expiration
3. **Authorization Checks**: GraphQL resolvers verify user permissions
4. **Secure Headers**: Token transmitted via Authorization header
5. **Input Validation**: Server-side validation of user inputs
6. **Protected Endpoints**: Unauthorized requests return proper error codes

## Testing

### Test Login
1. Start the application: `docker-compose up`
2. Navigate to `http://localhost:3000`
3. Login with credentials: `admin` / `admin123`
4. You should be redirected to the movie list

### Test User Management (Admin)
1. Login as admin
2. Click "Manage Users" in the navigation
3. Create a new user
4. Edit the user
5. Test login with the new user
6. Login as admin again and delete the test user

### Test Authorization
1. Create a non-admin user
2. Login as that user
3. Verify that "Manage Users" is not visible
4. Logout and login as admin to delete the test user

## Migration Guide

If you're upgrading an existing MovieNight installation:

1. Pull the latest code
2. Update your `.env` file with the new authentication variables
3. Run `docker-compose down` to stop existing containers
4. Run `docker-compose up --build` to rebuild with new changes
5. The database migration will run automatically
6. The admin user will be created on first startup
7. Login with the default admin credentials

## Troubleshooting

### "Invalid credentials" error
- Verify you're using the correct username and password
- Check if the admin user was created (check backend logs)
- Ensure the database migration ran successfully

### Token expired
- Tokens expire after 7 days
- Simply login again to get a new token

### Can't access user management
- Verify you're logged in as an admin user
- Check the `is_admin` field in the database

### Backend errors on startup
- Ensure all environment variables are set
- Check database connectivity
- Review backend logs for migration errors

## Future Enhancements

Potential improvements for the authentication system:

- Password reset functionality
- Email verification
- Multi-factor authentication (MFA)
- Password complexity requirements
- Account lockout after failed login attempts
- Audit logs for user actions
- Role-based access control (RBAC) beyond admin/non-admin
- OAuth/SSO integration
