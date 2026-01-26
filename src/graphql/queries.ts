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

export const LOGIN = gql`
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      token
      user {
        id
        username
        email
        is_admin
      }
    }
  }
`;

export const GET_ME = gql`
  query GetMe {
    me {
      id
      username
      email
      is_admin
      created_at
      updated_at
    }
  }
`;

export const GET_USERS = gql`
  query GetUsers {
    users {
      id
      username
      email
      is_admin
      created_at
      updated_at
    }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser($username: String!, $email: String!, $password: String!, $is_admin: Boolean) {
    createUser(username: $username, email: $email, password: $password, is_admin: $is_admin) {
      id
      username
      email
      is_admin
      created_at
      updated_at
    }
  }
`;

export const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $username: String, $email: String, $password: String, $is_admin: Boolean) {
    updateUser(id: $id, username: $username, email: $email, password: $password, is_admin: $is_admin) {
      id
      username
      email
      is_admin
      created_at
      updated_at
    }
  }
`;

export const DELETE_USER = gql`
  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id)
  }
`;
