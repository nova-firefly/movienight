import React from 'react';
import { Box, Button, Typography } from '@mui/joy';

interface ThisOrThatBannerProps {
  hasEloData: boolean;
  isAuthenticated: boolean;
  onShowThisOrThat?: () => void;
}

const ThisOrThatBanner: React.FC<ThisOrThatBannerProps> = ({
  hasEloData,
  isAuthenticated,
  onShowThisOrThat,
}) => (
  <Box
    sx={{
      mb: 3,
      p: 1.5,
      borderRadius: 'md',
      bgcolor: 'primary.softBg',
      border: '1px solid',
      borderColor: 'primary.outlinedBorder',
      textAlign: 'center',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
    }}
  >
    {isAuthenticated ? (
      <>
        <Typography level="body-sm" sx={{ color: 'primary.softColor' }}>
          {hasEloData ? 'Keep ranking movies!' : 'Rate movies to get your personal ranking.'}
        </Typography>
        {onShowThisOrThat && (
          <Button
            variant="soft"
            color="primary"
            size="sm"
            onClick={onShowThisOrThat}
            sx={{ fontWeight: 700 }}
          >
            This or That
          </Button>
        )}
      </>
    ) : (
      <Typography level="body-sm" sx={{ color: 'primary.softColor' }}>
        Sign in to rank movies with This or That
      </Typography>
    )}
  </Box>
);

export default ThisOrThatBanner;
