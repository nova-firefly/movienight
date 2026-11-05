import React from 'react';
import { Box, Typography } from '@mui/joy';

const GIT_BRANCH = process.env.REACT_APP_GIT_BRANCH;
const GIT_HASH = process.env.REACT_APP_GIT_HASH;
const DEPLOY_TIME = process.env.REACT_APP_DEPLOY_TIME;

function formatDeployTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  const parts: string[] = [];
  if (GIT_BRANCH) parts.push(`branch: ${GIT_BRANCH}`);
  if (GIT_HASH) parts.push(`commit: ${GIT_HASH.slice(0, 7)}`);
  if (DEPLOY_TIME && DEPLOY_TIME !== 'unknown')
    parts.push(`deployed: ${formatDeployTime(DEPLOY_TIME)}`);

  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        py: 2.5,
        px: { xs: 2, sm: 3 },
        borderTop: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexWrap: 'wrap',
        columnGap: 3,
        rowGap: 0.5,
        justifyContent: 'space-between',
      }}
    >
      <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
        &copy; {year} MovieNight
      </Typography>
      {parts.length > 0 && (
        <Box
          component="ul"
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, m: 0, p: 0, listStyle: 'none' }}
        >
          {parts.map((part) => (
            <Typography key={part} component="li" level="body-xs" sx={{ color: 'text.tertiary' }}>
              {part}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
};
