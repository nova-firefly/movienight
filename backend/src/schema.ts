export const typeDefs = `#graphql
  type Movie {
    id: ID!
    title: String!
    requester: String!
    date_submitted: String!
  }

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

  type Query {
    movies: [Movie!]!
    movie(id: ID!): Movie
    me: User
    users: [User!]!
    user(id: ID!): User
  }

  type Mutation {
    addMovie(title: String!, requester: String!): Movie!
    deleteMovie(id: ID!): Boolean!
    login(username: String!, password: String!): AuthPayload!
    createUser(username: String!, email: String!, password: String!, is_admin: Boolean): User!
    updateUser(id: ID!, username: String, email: String, password: String, is_admin: Boolean): User!
    deleteUser(id: ID!): Boolean!
  }
`;
