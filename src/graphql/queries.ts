import { gql } from '@apollo/client';

export const GET_MOVIES = gql`
  query GetMovies {
    movies {
      id
      title
      requester
      date_submitted
    }
  }
`;

export const GET_MOVIE = gql`
  query GetMovie($id: ID!) {
    movie(id: $id) {
      id
      title
      requester
      date_submitted
    }
  }
`;

export const ADD_MOVIE = gql`
  mutation AddMovie($title: String!, $requester: String!) {
    addMovie(title: $title, requester: $requester) {
      id
      title
      requester
      date_submitted
    }
  }
`;

export const DELETE_MOVIE = gql`
  mutation DeleteMovie($id: ID!) {
    deleteMovie(id: $id)
  }
`;
