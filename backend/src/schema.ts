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
    vapidPublicKey: String
  }

  type NotificationPreference {
    eventType: String!
    enabled: Boolean!
  }

  input PushSubscriptionKeysInput {
    p256dh: String!
    auth: String!
  }

  input PushSubscriptionInput {
    endpoint: String!
    keys: PushSubscriptionKeysInput!
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

  """A TV show — parallel to Movie, ranked by its own Elo pool (never mixed with movies)."""
  type Show {
    id: ID!
    title: String!
    requester: String!
    requested_by: ID
    date_submitted: String!
    elo_rank: Float
    tmdb_id: Int
    watched_at: String
    poster_url: String
    first_air_year: String
    created_by: [String!]!
    networks: [String!]!
    number_of_seasons: Int
    number_of_episodes: Int
    status: String
    """Manually-tracked next-up season (household-shared). Null when no progress is set."""
    next_season: Int
    """Manually-tracked next-up episode (household-shared). Null when no progress is set."""
    next_episode: Int
    """Derived "S{next_season} · E{next_episode}" chip label; null unless both are set."""
    episode_progress: String
    myTags: [ShowUserTag!]!
    userTags: [ShowUserTag!]!
  }

  """A per-user tag on a show. Boolean tags have null value; number/text tags carry a value."""
  type ShowUserTag {
    tag: Tag!
    user: ConnectionUser!
    value: String
    createdAt: String!
  }

  type TmdbShow {
    tmdb_id: Int!
    title: String!
    first_air_year: String
    overview: String
  }

  type ThisOrThatShow {
    id: ID!
    title: String!
    tmdb_id: Int
    poster_url: String
    first_air_year: String
    created_by: [String!]!
    networks: [String!]!
    number_of_seasons: Int
    number_of_episodes: Int
    cast: [String!]!
    tags: [String!]!
  }

  type ThisOrThatShowPair {
    showA: ThisOrThatShow!
    showB: ThisOrThatShow!
  }

  type ShowComparisonResult {
    winnerId: ID!
    loserId: ID!
    winnerElo: Float!
    loserElo: Float!
  }

  type ShowRanking {
    show: Show!
    eloRating: Float!
    comparisonCount: Int!
  }

  type CombinedShowRanking {
    show: Show!
    userAElo: Float
    userBElo: Float
    combinedElo: Float!
    bothRated: Boolean!
  }

  type CombinedShowListResult {
    connection: UserConnection!
    rankings: [CombinedShowRanking!]!
  }

  type PendingReviewShow {
    show: Show!
    addedBy: ConnectionUser!
  }

  type SetShowInterestResult {
    showId: ID!
    interested: Boolean!
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
    notificationPreferences: [NotificationPreference!]!
    shows: [Show!]!
    show(id: ID!): Show
    searchTmdbShows(query: String!): [TmdbShow!]!
    showThisOrThat(excludeIds: [ID!]): ThisOrThatShowPair!
    myShowRankings: [ShowRanking!]!
    combinedShowList(connectionId: ID!): CombinedShowListResult!
    newShowsFromConnections: [PendingReviewShow!]!
    soloShows: [Show!]!
    passedShowIds: [ID!]!
    watchedShows(limit: Int, offset: Int): [Show!]!
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
    syncMdblist: KometaExportResult!
    updateKometaSchedule(enabled: Boolean, frequency: String, dailyTime: String): KometaSchedule!
    setMdblistApiKey(apiKey: String!): KometaSchedule!
    importFromLetterboxd(url: String!): ImportResult!
    login(username: String!, password: String!): AuthPayload!
    createUser(username: String!, email: String!, password: String!, display_name: String, is_admin: Boolean, is_active: Boolean): User!
    updateUser(id: ID!, username: String, email: String, password: String, display_name: String, is_admin: Boolean, is_active: Boolean): User!
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
    subscribePush(subscription: PushSubscriptionInput!): Boolean!
    unsubscribePush(endpoint: String!): Boolean!
    updateNotificationPreference(eventType: String!, enabled: Boolean!): NotificationPreference!
    addShow(title: String!, tmdb_id: Int): Show!
    matchShow(id: ID!, tmdb_id: Int!, title: String!): Show!
    markShowWatched(id: ID!): Show!
    unwatchShow(id: ID!): Show!
    deleteShow(id: ID!): Boolean!
    recordShowComparison(winnerId: ID!, loserId: ID!): ShowComparisonResult!
    resetShowComparisons(showId: ID!): Boolean!
    setShowInterest(showId: ID!, interested: Boolean!): SetShowInterestResult!
    setShowTag(showId: ID!, tagSlug: String!, value: String): ShowUserTag!
    removeShowTag(showId: ID!, tagSlug: String!): Boolean!
    """Set or clear a show's household-shared episode progress. Pass both season and episode to set; omit both (or pass null) to clear."""
    setShowProgress(id: ID!, season: Int, episode: Int): Show!
    backfillShowTmdbData: Int!
  }
`;
