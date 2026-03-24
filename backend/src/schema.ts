export const typeDefs = `#graphql
  type Movie {
    id: ID!
    title: String!
    requester: String!
    date_submitted: String!
    rank: Float!
  }

  type User {
    id: ID!
    username: String!
    email: String!
    display_name: String
    is_admin: Boolean!
    is_active: Boolean!
    last_login_at: String
    created_at: String!
    updated_at: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type AuditLog {
    id: ID!
    actor_id: ID
    actor_username: String
    action: String!
    target_type: String
    target_id: String
    metadata: String
    ip_address: String
    created_at: String!
  }

  type LoginHistory {
    id: ID!
    user_id: ID
    username: String
    ip_address: String
    user_agent: String
    succeeded: Boolean!
    created_at: String!
  }

  type Query {
    movies: [Movie!]!
    movie(id: ID!): Movie
    me: User
    users: [User!]!
    user(id: ID!): User
    auditLogs(limit: Int, offset: Int): [AuditLog!]!
    loginHistory(userId: ID, limit: Int): [LoginHistory!]!
  }

  type Mutation {
    addMovie(title: String!): Movie!
    deleteMovie(id: ID!): Boolean!
    login(username: String!, password: String!): AuthPayload!
    createUser(username: String!, email: String!, password: String!, display_name: String, is_admin: Boolean, is_active: Boolean): User!
    updateUser(id: ID!, username: String, email: String, password: String, display_name: String, is_admin: Boolean, is_active: Boolean): User!
    deleteUser(id: ID!): Boolean!
  }
`;
