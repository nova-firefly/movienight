export const typeDefs = `#graphql
  type Movie {
    id: ID!
    title: String!
    requester: String!
    date_submitted: String!
  }

  type Query {
    movies: [Movie!]!
    movie(id: ID!): Movie
  }

  type Mutation {
    addMovie(title: String!, requester: String!): Movie!
    deleteMovie(id: ID!): Boolean!
  }
`;
