import { gql } from '@apollo/client';

export const GET_MOVIES = gql`
  query GetMovies {
    movies {
      id
      title
      requester
      requested_by
      date_submitted
      elo_rank
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
      elo_rank
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
      elo_rank
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
      elo_rank
      tmdb_id
    }
  }
`;

export const MARK_WATCHED = gql`
  mutation MarkWatched($id: ID!) {
    markWatched(id: $id) {
      id
      watched_at
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
  mutation CreateUser(
    $username: String!
    $email: String!
    $password: String!
    $display_name: String
    $is_admin: Boolean
    $is_active: Boolean
  ) {
    createUser(
      username: $username
      email: $email
      password: $password
      display_name: $display_name
      is_admin: $is_admin
      is_active: $is_active
    ) {
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
  mutation UpdateUser(
    $id: ID!
    $username: String
    $email: String
    $password: String
    $display_name: String
    $is_admin: Boolean
    $is_active: Boolean
  ) {
    updateUser(
      id: $id
      username: $username
      email: $email
      password: $password
      display_name: $display_name
      is_admin: $is_admin
      is_active: $is_active
    ) {
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
    exportKometa(collectionName: $collectionName) {
      filePath
      triggered
      triggerError
    }
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

export const IMPORT_FROM_LETTERBOXD = gql`
  mutation ImportFromLetterboxd($url: String!) {
    importFromLetterboxd(url: $url) {
      imported
      skipped
      tmdb_matched
      errors
    }
  }
`;

export const GET_KOMETA_SCHEDULE = gql`
  query GetKometaSchedule {
    kometaSchedule {
      enabled
      frequency
      dailyTime
      collectionName
      lastRunAt
    }
  }
`;

export const GET_APP_INFO = gql`
  query GetAppInfo {
    appInfo {
      isProduction
      quickLoginUsers {
        label
        username
        password
      }
    }
  }
`;

export const UPDATE_KOMETA_SCHEDULE = gql`
  mutation UpdateKometaSchedule(
    $enabled: Boolean
    $frequency: String
    $dailyTime: String
    $collectionName: String
  ) {
    updateKometaSchedule(
      enabled: $enabled
      frequency: $frequency
      dailyTime: $dailyTime
      collectionName: $collectionName
    ) {
      enabled
      frequency
      dailyTime
      collectionName
      lastRunAt
    }
  }
`;

export const THIS_OR_THAT = gql`
  query ThisOrThat($excludeIds: [ID!]) {
    thisOrThat(excludeIds: $excludeIds) {
      movieA {
        id
        title
        tmdb_id
        poster_url
        release_year
        director
        cast
        tags
      }
      movieB {
        id
        title
        tmdb_id
        poster_url
        release_year
        director
        cast
        tags
      }
    }
  }
`;

export const MY_RANKINGS = gql`
  query MyRankings {
    myRankings {
      movie {
        id
        title
        tmdb_id
        elo_rank
      }
      eloRating
      comparisonCount
    }
  }
`;

export const RECORD_COMPARISON = gql`
  mutation RecordComparison($winnerId: ID!, $loserId: ID!) {
    recordComparison(winnerId: $winnerId, loserId: $loserId) {
      winnerId
      loserId
      winnerElo
      loserElo
    }
  }
`;

export const RESET_MOVIE_COMPARISONS = gql`
  mutation ResetMovieComparisons($movieId: ID!) {
    resetMovieComparisons(movieId: $movieId)
  }
`;

export const SEED_MOVIES = gql`
  mutation SeedMovies {
    seedMovies
  }
`;

export const REQUEST_PASSWORD_RESET = gql`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email) {
      success
      message
    }
  }
`;

export const RESET_PASSWORD = gql`
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(token: $token, newPassword: $newPassword) {
      success
      message
    }
  }
`;

export const SEARCH_USERS = gql`
  query SearchUsers($query: String!) {
    searchUsers(query: $query) {
      id
      username
      display_name
    }
  }
`;

export const MY_CONNECTIONS = gql`
  query MyConnections {
    myConnections {
      id
      user {
        id
        username
        display_name
      }
      status
      direction
      created_at
    }
  }
`;

export const PENDING_CONNECTION_REQUESTS = gql`
  query PendingConnectionRequests {
    pendingConnectionRequests {
      id
      user {
        id
        username
        display_name
      }
      status
      direction
      created_at
    }
  }
`;

export const COMBINED_LIST = gql`
  query CombinedList($connectionId: ID!) {
    combinedList(connectionId: $connectionId) {
      connection {
        id
        user {
          id
          username
          display_name
        }
      }
      rankings {
        movie {
          id
          title
          tmdb_id
          elo_rank
        }
        userAElo
        userBElo
        combinedElo
        bothRated
      }
    }
  }
`;

export const SEND_CONNECTION_REQUEST = gql`
  mutation SendConnectionRequest($addresseeId: ID!) {
    sendConnectionRequest(addresseeId: $addresseeId) {
      id
      user {
        id
        username
        display_name
      }
      status
      direction
    }
  }
`;

export const RESPOND_TO_CONNECTION_REQUEST = gql`
  mutation RespondToConnectionRequest($connectionId: ID!, $accept: Boolean!) {
    respondToConnectionRequest(connectionId: $connectionId, accept: $accept) {
      id
      status
    }
  }
`;

export const REMOVE_CONNECTION = gql`
  mutation RemoveConnection($connectionId: ID!) {
    removeConnection(connectionId: $connectionId)
  }
`;
