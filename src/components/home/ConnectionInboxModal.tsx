import React, { useState } from 'react';
import { Modal, ModalDialog, ModalClose, Box, Button, Typography, Sheet, Chip } from '@mui/joy';
import { useToast } from '../../contexts/ToastContext';

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
                      <Box sx={{ minWidth: 0 }}>
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
                          gap: 0.75,
                        }}
                      >
                        <Button
                          size="sm"
                          variant="soft"
                          color="success"
                          onClick={() => handleResponse(movieId, true, false, addedByName)}
                          sx={{ fontWeight: 600 }}
                        >
                          Count me in!
                        </Button>
                        <Button
                          size="sm"
                          variant="soft"
                          color="warning"
                          onClick={() => handleResponse(movieId, true, true, addedByName)}
                          sx={{ fontWeight: 600 }}
                        >
                          Rewatch? Yes!
                        </Button>
                        <Button
                          size="sm"
                          variant="plain"
                          color="neutral"
                          onClick={() => handleResponse(movieId, false, false, addedByName)}
                        >
                          Not for me
                        </Button>
                        <Button
                          size="sm"
                          variant="plain"
                          color="neutral"
                          onClick={() => handleResponse(movieId, false, true, addedByName)}
                        >
                          Seen it, pass
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
