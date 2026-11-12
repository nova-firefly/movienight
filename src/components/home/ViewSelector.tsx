import React from 'react';
import { Box, Button } from '@mui/joy';

interface Connection {
  id: string;
  user: { display_name?: string; username: string };
}

interface ViewSelectorProps {
  connections: Connection[];
  soloMovieCount: number;
  selectedConnectionId: string | null;
  onSelect: (connectionId: string | null) => void;
}

const ViewSelector: React.FC<ViewSelectorProps> = ({
  connections,
  soloMovieCount,
  selectedConnectionId,
  onSelect,
}) => {
  const isSoloView = selectedConnectionId === 'solo';
  const isCombinedView = selectedConnectionId !== null && !isSoloView;

  // Underlined tab row: one weight in every state, the current tab in ink with
  // an accent rule. Scrolls sideways on a phone rather than wrapping.
  const tabSx = (active: boolean) => ({
    fontWeight: 600,
    flexShrink: 0,
    borderRadius: 0,
    px: 1.5,
    minHeight: 44,
    color: active ? 'text.primary' : 'text.secondary',
    boxShadow: active ? 'inset 0 -2px 0 var(--color-accent)' : 'none',
    '&:hover': { color: 'text.primary', bgcolor: 'transparent' },
    '&:active': { bgcolor: 'var(--color-hover)' },
    '&:focus-visible': { outlineOffset: '-2px' },
  });

  return (
    <Box
      role="tablist"
      aria-label="Queue view"
      sx={{
        display: 'flex',
        overflowX: 'auto',
        gap: 0.5,
        mb: 3,
        borderBottom: '1px solid var(--color-rule)',
      }}
    >
      {connections.map((conn) => (
        <Button
          key={conn.id}
          variant="plain"
          color="neutral"
          size="sm"
          role="tab"
          aria-selected={selectedConnectionId === conn.id}
          onClick={() => onSelect(conn.id)}
          sx={tabSx(selectedConnectionId === conn.id)}
        >
          {conn.user.display_name || conn.user.username} + Me
        </Button>
      ))}
      {soloMovieCount > 0 && (
        <Button
          variant="plain"
          color="neutral"
          size="sm"
          role="tab"
          aria-selected={isSoloView}
          onClick={() => onSelect('solo')}
          sx={tabSx(isSoloView)}
        >
          Watch Alone
        </Button>
      )}
      <Button
        variant="plain"
        color="neutral"
        size="sm"
        role="tab"
        aria-selected={!isCombinedView && !isSoloView}
        onClick={() => onSelect(null)}
        sx={tabSx(!isCombinedView && !isSoloView)}
      >
        My Suggestions
      </Button>
    </Box>
  );
};

export default ViewSelector;
