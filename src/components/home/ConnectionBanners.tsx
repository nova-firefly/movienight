import React from 'react';
import { Box, Button, Typography } from '@mui/joy';

interface ConnectionBannersProps {
  incomingPending: any[];
  onShowConnections?: () => void;
}

const ConnectionBanners: React.FC<ConnectionBannersProps> = ({
  incomingPending,
  onShowConnections,
}) => {
  if (incomingPending.length === 0) return null;

  return (
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
  );
};

export default ConnectionBanners;
