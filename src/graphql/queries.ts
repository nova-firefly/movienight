import { gql } from '@apollo/client';

export const GET_MOVIES = gql`
  query GetMovies {
    movies {
      id
      title
      requester
      requested_by
      date_submitted
      rank
      tmdb_id
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
      rank
    }
  }
`;

export const ADD_MOVIE = gql`
  mutation AddMovie($title: String!, $tmdb_id: Int) {
    addMovie(title: $title, tmdb_id: $tmdb_id) {
      id
      title
      requester
      date_submitted
      rank
      tmdb_id
    }
  }
`;

export const SEARCH_TMDB = gql`
  query SearchTmdb($query: String!) {
    searchTmdb(query: $query) {
      tmdb_id
      title
      release_year
      overview
    }
  }
`;

export const MATCH_MOVIE = gql`
  mutation MatchMovie($id: ID!, $tmdb_id: Int!, $title: String!) {
    matchMovie(id: $id, tmdb_id: $tmdb_id, title: $title) {
      id
      title
      requester
      date_submitted
      rank
      tmdb_id
    }
  }
`;

export const DELETE_MOVIE = gql`
  mutation DeleteMovie($id: ID!) {
    deleteMovie(id: $id)
  }
`;

export const REORDER_MOVIE = gql`
  mutation ReorderMovie($id: ID!, $afterId: ID) {
    reorderMovie(id: $id, afterId: $afterId)
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
        display_name
        is_admin
        is_active
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
      display_name
      is_admin
      is_active
      last_login_at
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
      display_name
      is_admin
      is_active
      last_login_at
      created_at
      updated_at
    }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser($username: String!, $email: String!, $password: String!, $display_name: String, $is_admin: Boolean, $is_active: Boolean) {
    createUser(username: $username, email: $email, password: $password, display_name: $display_name, is_admin: $is_admin, is_active: $is_active) {
      id
      username
      email
      display_name
      is_admin
      is_active
      last_login_at
      created_at
      updated_at
    }
  }
`;

export const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $username: String, $email: String, $password: String, $display_name: String, $is_admin: Boolean, $is_active: Boolean) {
    updateUser(id: $id, username: $username, email: $email, password: $password, display_name: $display_name, is_admin: $is_admin, is_active: $is_active) {
      id
      username
      email
      display_name
      is_admin
      is_active
      last_login_at
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

export const EXPORT_KOMETA = gql`
  mutation ExportKometa($collectionName: String) {
    exportKometa(collectionName: $collectionName)
  }
`;

export const GET_AUDIT_LOGS = gql`
  query GetAuditLogs($limit: Int, $offset: Int) {
    auditLogs(limit: $limit, offset: $offset) {
      id
      actor_id
      actor_username
      action
      target_type
      target_id
      metadata
      ip_address
      created_at
    }
  }
`;

export const GET_LOGIN_HISTORY = gql`
  query GetLoginHistory($userId: ID, $limit: Int) {
    loginHistory(userId: $userId, limit: $limit) {
      id
      user_id
      username
      ip_address
      user_agent
      succeeded
      created_at
    }
  }
`;
