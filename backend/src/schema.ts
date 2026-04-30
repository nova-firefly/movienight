export const typeDefs = `#graphql
  type Movie {
    id: ID!
    title: String!
    requester: String!
    requested_by: ID
    date_submitted: String!
    elo_rank: Float
    tmdb_id: Int
    watched_at: String
    poster_url: String
    myTags: [MovieUserTag!]!
    userTags: [MovieUserTag!]!
  }

  type TmdbMovie {
    tmdb_id: Int!
    title: String!
    release_year: String
    overview: String
  }

  type User {
    id: ID!
    username: String!
    email: String!
    display_name: String
    is_admin: Boolean!
    is_active: Boolean!
    last_login_at: String
    plex_id: String
    plex_username: String
    plex_thumb: String
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

  type KometaListExportResult {
    name: String!
    type: String!
    movieCount: Int!
    mdblistUrl: String
  }

  type KometaSchedule {
    enabled: Boolean!
    frequency: String!
    dailyTime: String!
    lastRunAt: String
    mdblistApiKeySet: Boolean!
    exportedLists: [KometaListExportResult!]!
  }

  type QuickLoginUser {
    label: String!
    username: String!
    password: String!
  }

  type AppInfo {
    isProduction: Boolean!
    quickLoginUsers: [QuickLoginUser!]!
    plexAuthEnabled: Boolean!
  }

  type PlexPin {
    pinId: Int!
    code: String!
    authUrl: String!
  }

  type ThisOrThatMovie {
    id: ID!
    title: String!
    tmdb_id: Int
    poster_url: String
    release_year: String
    director: String
    cast: [String!]!
    tags: [String!]!
  }

  type ThisOrThatPair {
    movieA: ThisOrThatMovie!
    movieB: ThisOrThatMovie!
  }

  type ComparisonResult {
    winnerId: ID!
    loserId: ID!
    winnerElo: Float!
    loserElo: Float!
  }

  type MovieRanking {
    movie: Movie!
    eloRating: Float!
    comparisonCount: Int!
  }

  type ConnectionUser {
    id: ID!
    username: String!
    display_name: String
  }

  type UserConnection {
    id: ID!
    user: ConnectionUser!
    status: String!
    direction: String!
    created_at: String!
  }

  type CombinedRanking {
    movie: Movie!
    userAElo: Float
    userBElo: Float
    combinedElo: Float!
    bothRated: Boolean!
  }

  type CombinedListResult {
    connection: UserConnection!
    rankings: [CombinedRanking!]!
  }

  type PendingReviewMovie {
    movie: Movie!
    addedBy: ConnectionUser!
  }

  type SetInterestResult {
    movieId: ID!
    interested: Boolean!
  }

  """Tag definition (e.g. 'seen', 'podcast-ep'). Extensible — new tags can be added to the DB."""
  type Tag {
    id: ID!
    slug: String!
    label: String!
    valueType: String!
  }

  """A per-user tag on a movie. Boolean tags have null value; number/text tags carry a value."""
  type MovieUserTag {
    tag: Tag!
    user: ConnectionUser!
    value: String
    createdAt: String!
  }

  type Query {
    appInfo: AppInfo!
    movies: [Movie!]!
    movie(id: ID!): Movie
    me: User
    users: [User!]!
    user(id: ID!): User
    auditLogs(limit: Int, offset: Int): [AuditLog!]!
    loginHistory(userId: ID, limit: Int): [LoginHistory!]!
    searchTmdb(query: String!): [TmdbMovie!]!
    kometaSchedule: KometaSchedule!
    thisOrThat(excludeIds: [ID!]): ThisOrThatPair!
    myRankings: [MovieRanking!]!
    searchUsers(query: String!): [ConnectionUser!]!
    myConnections: [UserConnection!]!
    pendingConnectionRequests: [UserConnection!]!
    combinedList(connectionId: ID!): CombinedListResult!
    newMoviesFromConnections: [PendingReviewMovie!]!
    soloMovies: [Movie!]!
    passedMovieIds: [ID!]!
    tags: [Tag!]!
    watchedMovies(limit: Int, offset: Int): [Movie!]!
  }

  type ImportResult {
    imported: Int!
    skipped: Int!
    tmdb_matched: Int!
    errors: [String!]!
  }

  type KometaExportResult {
    filePath: String
    yamlContent: String!
    triggered: Boolean!
    triggerError: String
    lists: [KometaListExportResult!]!
  }

  type PasswordResetResult {
    success: Boolean!
    message: String!
  }

  type Mutation {
    requestPasswordReset(email: String!): PasswordResetResult!
    resetPassword(token: String!, newPassword: String!): PasswordResetResult!
    addMovie(title: String!, tmdb_id: Int): Movie!
    matchMovie(id: ID!, tmdb_id: Int!, title: String!): Movie!
    markWatched(id: ID!): Movie!
    deleteMovie(id: ID!): Boolean!
    recordComparison(winnerId: ID!, loserId: ID!): ComparisonResult!
    resetMovieComparisons(movieId: ID!): Boolean!
    exportKometa: KometaExportResult!
    updateKometaSchedule(enabled: Boolean, frequency: String, dailyTime: String): KometaSchedule!
    setMdblistApiKey(apiKey: String!): KometaSchedule!
    importFromLetterboxd(url: String!): ImportResult!
    login(username: String!, password: String!): AuthPayload!
    createPlexPin: PlexPin!
    completePlexAuth(pinId: Int!): AuthPayload!
    linkPlexAccount(pinId: Int!): User!
    unlinkPlexAccount: User!
    createUser(username: String!, email: String!, password: String!, display_name: String, is_admin: Boolean, is_active: Boolean): User!
    updateUser(id: ID!, username: String, email: String, password: String, display_name: String, is_admin: Boolean, is_active: Boolean, plex_id: String): User!
    deleteUser(id: ID!): Boolean!
    seedMovies: Int!
    backfillTmdbData: Int!
    sendConnectionRequest(addresseeId: ID!): UserConnection!
    respondToConnectionRequest(connectionId: ID!, accept: Boolean!): UserConnection!
    removeConnection(connectionId: ID!): Boolean!
    setMovieInterest(movieId: ID!, interested: Boolean!): SetInterestResult!
    setMovieTag(movieId: ID!, tagSlug: String!, value: String): MovieUserTag!
    removeMovieTag(movieId: ID!, tagSlug: String!): Boolean!
    unwatchMovie(id: ID!): Movie!
  }
`;
