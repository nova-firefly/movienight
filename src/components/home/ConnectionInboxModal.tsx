import React, { useState } from 'react';
import { Modal, ModalDialog, ModalClose, Box, Button, Typography, Sheet, Chip } from '@mui/joy';
import { useToast } from '../../contexts/ToastContext';

const formatRelativeDate = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

interface ConnectionInboxModalProps {
  open: boolean;
  onClose: () => void;
  pendingMovies: any[];
  onSetInterest: (movieId: string, interested: boolean) => void;
  onSetSeenTag: (movieId: string) => Promise<void>;
}

const ConnectionInboxModal: React.FC<ConnectionInboxModalProps> = ({
  open,
  onClose,
  pendingMovies,
  onSetInterest,
  onSetSeenTag,
}) => {
  const { showSuccess } = useToast();
  // movieId → confirmation message shown after responding
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

    setResponded((prev) => ({ ...prev, [movieId]: message }));
    showSuccess(message);

    onSetInterest(movieId, interested);
    if (seen) {
      try {
        await onSetSeenTag(movieId);
      } catch {
        /* tag failure is non-critical */
      }
    }
  };

  const remaining = pendingMovies.filter((p) => !responded[p.movie.id]).length;

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ maxWidth: 600, width: '100%', p: { xs: 2, sm: 3 } }}>
        <ModalClose />

        <Box sx={{ mb: 2, pr: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography level="title-md" sx={{ fontWeight: 700 }}>
              Suggestions from your connections
            </Typography>
            {remaining > 0 && (
              <Chip size="sm" variant="solid" color="primary">
                {remaining}
              </Chip>
            )}
          </Box>
          <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
            {remaining > 0
              ? 'Tap one button per movie — say if you want to watch it together or pass.'
              : 'All caught up!'}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
            maxHeight: { xs: '60vh', sm: '70vh' },
            overflowY: 'auto',
            mx: -1,
            px: 1,
          }}
        >
          {pendingMovies.length === 0 ? (
            <Typography level="body-sm" sx={{ textAlign: 'center', color: 'text.tertiary', py: 4 }}>
              No new suggestions to review.
            </Typography>
          ) : (
            pendingMovies.map((item: any) => {
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
                        flexDirection: 'column',
                        gap: 1.25,
                      }}
                    >
                      {/* Movie info */}
                      <Box sx={{ display: 'flex', gap: 1.25, minWidth: 0 }}>
                        {/* Poster */}
                        {item.movie.poster_url ? (
                          <img
                            src={item.movie.poster_url}
                            alt=""
                            style={{
                              width: 52,
                              height: 78,
                              objectFit: 'cover',
                              borderRadius: 4,
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: 52,
                              height: 78,
                              bgcolor: 'background.level2',
                              borderRadius: '4px',
                              flexShrink: 0,
                            }}
                          />
                        )}

                        {/* Title + meta */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                            {item.movie.title}
                            {item.movie.tmdb_id && (
                              <a
                                href={`https://www.themoviedb.org/movie/${item.movie.tmdb_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: 'var(--joy-palette-primary-500)',
                                  fontSize: '0.7rem',
                                  marginLeft: 4,
                                  textDecoration: 'none',
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                ↗
                              </a>
                            )}
                          </Typography>
                          <Typography level="body-xs" sx={{ color: 'text.tertiary', mb: 0.5 }}>
                            added by {addedByName} · {formatRelativeDate(item.movie.date_submitted)}
                          </Typography>

                          {/* Tags row */}
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                            {(() => {
                              const seenTags = (item.movie.userTags ?? []).filter(
                                (t: any) => t.tag.slug === 'seen',
                              );
                              const seenNames = seenTags.map(
                                (t: any) => t.user.display_name || t.user.username,
                              );
                              if (seenTags.length > 0) {
                                return (
                                  <Chip size="sm" variant="soft" color="warning">
                                    Seen by {seenNames.join(', ')}
                                  </Chip>
                                );
                              }
                              return (
                                <Chip size="sm" variant="soft" color="neutral">
                                  Not yet seen by group
                                </Chip>
                              );
                            })()}
                            {!item.movie.tmdb_id && (
                              <Chip size="sm" variant="soft" color="neutral">
                                No TMDB match
                              </Chip>
                            )}
                          </Box>
                        </Box>
                      </Box>

                      {/* 3-button asymmetric: two "in" variants + full-width pass */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 0.75,
                          }}
                        >
                          <Button
                            size="sm"
                            variant="solid"
                            color="success"
                            onClick={() => handleResponse(movieId, true, false, addedByName)}
                            sx={{
                              flexDirection: 'column',
                              alignItems: 'stretch',
                              py: 0.75,
                              fontWeight: 700,
                              lineHeight: 1.2,
                            }}
                          >
                            <span>Add to queue</span>
                            <Typography
                              level="body-xs"
                              sx={{
                                color: 'inherit',
                                opacity: 0.85,
                                fontWeight: 500,
                                mt: 0.25,
                              }}
                            >
                              I haven't seen it
                            </Typography>
                          </Button>
                          <Button
                            size="sm"
                            variant="soft"
                            color="warning"
                            onClick={() => handleResponse(movieId, true, true, addedByName)}
                            sx={{
                              flexDirection: 'column',
                              alignItems: 'stretch',
                              py: 0.75,
                              fontWeight: 700,
                              lineHeight: 1.2,
                            }}
                          >
                            <span>Add as rewatch</span>
                            <Typography
                              level="body-xs"
                              sx={{
                                color: 'inherit',
                                opacity: 0.85,
                                fontWeight: 500,
                                mt: 0.25,
                              }}
                            >
                              I've seen it before
                            </Typography>
                          </Button>
                        </Box>
                        <Button
                          size="sm"
                          variant="plain"
                          color="neutral"
                          onClick={() => handleResponse(movieId, false, false, addedByName)}
                          sx={{ fontWeight: 500 }}
                        >
                          Pass — I don't want to watch
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Sheet>
              );
            })
          )}
        </Box>

        <Button
          variant="plain"
          color="neutral"
          onClick={onClose}
          sx={{ mt: 2, alignSelf: 'flex-end' }}
        >
          Done
        </Button>
      </ModalDialog>
    </Modal>
  );
};

export default ConnectionInboxModal;
