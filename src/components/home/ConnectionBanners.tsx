import React, { useState } from 'react';
import { Box, Button, Typography, Sheet, Chip } from '@mui/joy';
import { useToast } from '../../contexts/ToastContext';

interface ConnectionBannersProps {
  incomingPending: any[];
  pendingMovies: any[];
  onShowConnections?: () => void;
  onSetInterest: (movieId: string, interested: boolean) => void;
  onSetSeenTag: (movieId: string) => Promise<void>;
}

const ConnectionBanners: React.FC<ConnectionBannersProps> = ({
  incomingPending,
  pendingMovies,
  onShowConnections,
  onSetInterest,
  onSetSeenTag,
}) => {
  const { showSuccess } = useToast();
  // Track responded movies: movieId → confirmation message
  const [responded, setResponded] = useState<Record<string, string>>({});

  const handleResponse = async (
    movieId: string,
    interested: boolean,
    seen: boolean,
    addedByName: string,
  ) => {
    const message = interested
      ? `Added to your queue with ${addedByName}!`
      : 'Moved to Watch Alone';

    // Show inline confirmation immediately
    setResponded((prev) => ({ ...prev, [movieId]: message }));
    showSuccess(message);

    // Fire mutations
    onSetInterest(movieId, interested);
    if (seen) {
      try {
        await onSetSeenTag(movieId);
      } catch {
        /* tag failure is non-critical */
      }
    }
  };

  return (
    <>
      {/* Pending connection request banner */}
      {incomingPending.length > 0 && (
        <Box
          sx={{
            mb: 3,
            p: 1.5,
            borderRadius: 'md',
            bgcolor: 'warning.softBg',
            border: '1px solid',
            borderColor: 'warning.outlinedBorder',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <Typography level="body-sm" sx={{ color: 'warning.softColor' }}>
            {incomingPending.length === 1
              ? `${incomingPending[0].user.display_name || incomingPending[0].user.username} wants to connect`
              : `${incomingPending.length} pending connection requests`}
          </Typography>
          {onShowConnections && (
            <Button
              variant="soft"
              color="warning"
              size="sm"
              onClick={onShowConnections}
              sx={{ fontWeight: 700 }}
            >
              View
            </Button>
          )}
        </Box>
      )}

      {/* New suggestions from connections — prominent inbox */}
      {pendingMovies.length > 0 && (
        <Sheet
          variant="outlined"
          sx={{
            mb: 3,
            p: { xs: 1.5, sm: 2 },
            borderRadius: 'md',
            bgcolor: 'primary.softBg',
            borderColor: 'primary.400',
            borderWidth: 1.5,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 1.5,
            }}
          >
            <Typography level="title-sm" sx={{ fontWeight: 700, color: 'primary.softColor' }}>
              New suggestions from your connections
            </Typography>
            <Chip size="sm" variant="solid" color="primary">
              {pendingMovies.length}
            </Chip>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {pendingMovies.map((item: any) => {
              const movieId = item.movie.id;
              const addedByName = item.addedBy.display_name || item.addedBy.username;
              const confirmationMessage = responded[movieId];

              return (
                <Sheet
                  key={movieId}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 'sm',
                    bgcolor: 'background.surface',
                    borderColor: confirmationMessage
                      ? 'success.outlinedBorder'
                      : 'neutral.outlinedBorder',
                    transition: 'all 0.3s ease',
                    opacity: confirmationMessage ? 0.7 : 1,
                  }}
                >
                  {confirmationMessage ? (
                    <Typography
                      level="body-sm"
                      sx={{ textAlign: 'center', color: 'success.plainColor', fontWeight: 600 }}
                    >
                      {confirmationMessage}
                    </Typography>
                  ) : (
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: { xs: 1, sm: 1.5 },
                      }}
                    >
                      {/* Movie info */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                          {item.movie.title}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                          added by {addedByName}
                        </Typography>
                      </Box>

                      {/* 4-button response grid */}
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 0.5,
                          flexShrink: 0,
                          minWidth: { sm: 280 },
                        }}
                      >
                        {/* I'm in + not seen */}
                        <Button
                          size="sm"
                          variant="soft"
                          color="success"
                          onClick={() => handleResponse(movieId, true, false, addedByName)}
                          sx={{ fontSize: '0.75rem', fontWeight: 600 }}
                        >
                          Count me in!
                        </Button>
                        {/* I'm in + seen */}
                        <Button
                          size="sm"
                          variant="soft"
                          color="warning"
                          onClick={() => handleResponse(movieId, true, true, addedByName)}
                          sx={{ fontSize: '0.75rem', fontWeight: 600 }}
                        >
                          Rewatch? Yes!
                        </Button>
                        {/* Pass + not seen */}
                        <Button
                          size="sm"
                          variant="plain"
                          color="neutral"
                          onClick={() => handleResponse(movieId, false, false, addedByName)}
                          sx={{ fontSize: '0.75rem' }}
                        >
                          Not for me
                        </Button>
                        {/* Pass + seen */}
                        <Button
                          size="sm"
                          variant="plain"
                          color="neutral"
                          onClick={() => handleResponse(movieId, false, true, addedByName)}
                          sx={{ fontSize: '0.75rem' }}
                        >
                          Seen it, pass
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Sheet>
              );
            })}
          </Box>
        </Sheet>
      )}
    </>
  );
};

export default ConnectionBanners;
