import React from 'react';
import { Box, Tabs, TabList, Tab, TabPanel, Typography } from '@mui/joy';
import { UserManagement } from './UserManagement';
import { AuditLog } from './AuditLog';
import { LoginHistory } from './LoginHistory';
import { KometaExport } from './KometaExport';
import { LetterboxdImport } from './LetterboxdImport';

// Underlined tabs, matching the queue's view tabs: one weight, the current tab
// in ink over an accent rule.
const tabSx = {
  fontWeight: 600,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  minHeight: 44,
  bgcolor: 'transparent',
  color: 'text.secondary',
  '&:hover': { color: 'text.primary', bgcolor: 'transparent' },
  '&[aria-selected="true"]': { color: 'text.primary', bgcolor: 'transparent' },
} as const;

export const AdminPanel: React.FC = () => {
  return (
    <Box>
      <Typography level="h1" sx={{ fontSize: { xs: '2.5rem', sm: '3.5rem' }, mb: 3 }}>
        Admin
      </Typography>
      <Tabs defaultValue="users" sx={{ bgcolor: 'transparent' }}>
        <TabList
          sx={{
            bgcolor: 'transparent',
            gap: 0.5,
            mb: 3,
            '--Tab-indicatorThickness': '2px',
            '--Tab-indicatorColor': 'var(--color-accent)',
            '--ListDivider-gap': '0px',
            overflowX: 'auto',
            flexWrap: 'nowrap',
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}
        >
          <Tab value="users" sx={tabSx}>
            Users
          </Tab>
          <Tab value="audit" sx={tabSx}>
            Audit Log
          </Tab>
          <Tab value="logins" sx={tabSx}>
            Login History
          </Tab>
          <Tab value="kometa" sx={tabSx}>
            Kometa Export
          </Tab>
          <Tab value="import" sx={tabSx}>
            Import
          </Tab>
        </TabList>
        <TabPanel value="users" sx={{ p: 0 }}>
          <UserManagement />
        </TabPanel>
        <TabPanel value="audit" sx={{ p: 0 }}>
          <AuditLog />
        </TabPanel>
        <TabPanel value="logins" sx={{ p: 0 }}>
          <LoginHistory />
        </TabPanel>
        <TabPanel value="kometa" sx={{ p: 0 }}>
          <KometaExport />
        </TabPanel>
        <TabPanel value="import" sx={{ p: 0 }}>
          <LetterboxdImport />
        </TabPanel>
      </Tabs>
    </Box>
  );
};
