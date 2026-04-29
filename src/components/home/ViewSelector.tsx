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

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 0.5,
        mb: 3,
      }}
    >
      {connections.map((conn) => (
        <Button
          key={conn.id}
          variant={selectedConnectionId === conn.id ? 'soft' : 'plain'}
          color="neutral"
          size="sm"
          onClick={() => onSelect(conn.id)}
          sx={{
            fontWeight: 600,
            color: selectedConnectionId === conn.id ? 'primary.400' : 'text.secondary',
            '&:hover': { color: 'primary.300' },
          }}
        >
          {conn.user.display_name || conn.user.username} + Me
        </Button>
      ))}
      {soloMovieCount > 0 && (
        <Button
          variant={isSoloView ? 'soft' : 'plain'}
          color="neutral"
          size="sm"
          onClick={() => onSelect('solo')}
          sx={{
            fontWeight: 600,
            color: isSoloView ? 'primary.400' : 'text.secondary',
            '&:hover': { color: 'primary.300' },
          }}
        >
          Solo Queue
        </Button>
      )}
      <Button
        variant={!isCombinedView && !isSoloView ? 'soft' : 'plain'}
        color="neutral"
        size="sm"
        onClick={() => onSelect(null)}
        sx={{
          fontWeight: 600,
          color: !isCombinedView && !isSoloView ? 'primary.400' : 'text.secondary',
          '&:hover': { color: 'primary.300' },
        }}
      >
        My Requested
      </Button>
    </Box>
  );
};

export default ViewSelector;
