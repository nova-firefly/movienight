import React from 'react';
import { Box, Button, Typography, Sheet } from '@mui/joy';

interface ConnectionBannersProps {
  incomingPending: any[];
  pendingMovies: any[];
  askSeenMovieId: string | null;
  setAskSeenMovieId: (id: string | null) => void;
  onShowConnections?: () => void;
  onSetInterest: (movieId: string, interested: boolean) => void;
  onSetSeenTag: (movieId: string) => Promise<void>;
}

const ConnectionBanners: React.FC<ConnectionBannersProps> = ({
  incomingPending,
  pendingMovies,
  askSeenMovieId,
  setAskSeenMovieId,
  onShowConnections,
  onSetInterest,
  onSetSeenTag,
}) => (
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

    {/* New movies from connections — review banner */}
    {pendingMovies.length > 0 && (
      <Sheet
        variant="outlined"
        sx={{
          mb: 3,
          p: 2,
          borderRadius: 'md',
          bgcolor: 'primary.softBg',
          borderColor: 'primary.outlinedBorder',
        }}
      >
        <Typography level="title-sm" sx={{ fontWeight: 700, mb: 1.5, color: 'primary.softColor' }}>
          New movies from your connections
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {pendingMovies.map((item: any) => (
            <Box
              key={item.movie.id}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 1,
                borderRadius: 'sm',
                bgcolor: 'background.level1',
              }}
            >
              <Box>
                <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                  {item.movie.title}
                </Typography>
                <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                  added by {item.addedBy.display_name || item.addedBy.username}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                {askSeenMovieId === item.movie.id ? (
                  <>
                    <Typography level="body-xs" sx={{ color: 'text.tertiary', mr: 0.5 }}>
                      Seen it?
                    </Typography>
                    <Button
                      size="sm"
                      variant="soft"
                      color="warning"
                      onClick={async () => {
                        setAskSeenMovieId(null);
                        onSetInterest(item.movie.id, true);
                        try {
                          await onSetSeenTag(item.movie.id);
                        } catch {}
                      }}
                    >
                      Yes
                    </Button>
                    <Button
                      size="sm"
                      variant="plain"
                      color="neutral"
                      onClick={() => {
                        setAskSeenMovieId(null);
                        onSetInterest(item.movie.id, true);
                      }}
                    >
                      No
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="soft"
                      color="success"
                      onClick={() => setAskSeenMovieId(item.movie.id)}
                    >
                      I'm in
                    </Button>
                    <Button
                      size="sm"
                      variant="plain"
                      color="neutral"
                      onClick={() => onSetInterest(item.movie.id, false)}
                    >
                      Pass
                    </Button>
                  </>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      </Sheet>
    )}
  </>
);

export default ConnectionBanners;
