import React from 'react';
import { Box, Tabs, TabList, Tab, TabPanel, Typography } from '@mui/joy';
import { UserManagement } from './UserManagement';
import { AuditLog } from './AuditLog';
import { LoginHistory } from './LoginHistory';
import { KometaExport } from './KometaExport';
import { LetterboxdImport } from './LetterboxdImport';
import { Settings } from './Settings';

export const AdminPanel: React.FC = () => {
  return (
    <Box>
      <Typography level="h3" sx={{ fontWeight: 800, mb: 3, letterSpacing: '-0.02em' }}>
        Admin
      </Typography>
      <Tabs defaultValue="users" sx={{ bgcolor: 'transparent' }}>
        <TabList
          sx={{
            bgcolor: 'background.surface',
            borderRadius: 'sm',
            border: '1px solid',
            borderColor: 'var(--mn-border-vis)',
            p: 0.5,
            gap: 0.5,
            mb: 3,
            '--Tab-indicatorThickness': '0px',
            overflowX: 'auto',
            flexWrap: 'nowrap',
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}
        >
          <Tab
            value="users"
            sx={{
              borderRadius: 'xs',
              fontWeight: 600,
              fontSize: '0.85rem',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              '&[aria-selected="true"]': {
                bgcolor: 'background.level2',
                color: 'primary.400',
              },
            }}
          >
            Users
          </Tab>
          <Tab
            value="audit"
            sx={{
              borderRadius: 'xs',
              fontWeight: 600,
              fontSize: '0.85rem',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              '&[aria-selected="true"]': {
                bgcolor: 'background.level2',
                color: 'primary.400',
              },
            }}
          >
            Audit Log
          </Tab>
          <Tab
            value="logins"
            sx={{
              borderRadius: 'xs',
              fontWeight: 600,
              fontSize: '0.85rem',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              '&[aria-selected="true"]': {
                bgcolor: 'background.level2',
                color: 'primary.400',
              },
            }}
          >
            Login History
          </Tab>
          <Tab
            value="kometa"
            sx={{
              borderRadius: 'xs',
              fontWeight: 600,
              fontSize: '0.85rem',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              '&[aria-selected="true"]': {
                bgcolor: 'background.level2',
                color: 'primary.400',
              },
            }}
          >
            Kometa Export
          </Tab>
          <Tab
            value="import"
            sx={{
              borderRadius: 'xs',
              fontWeight: 600,
              fontSize: '0.85rem',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              '&[aria-selected="true"]': {
                bgcolor: 'background.level2',
                color: 'primary.400',
              },
            }}
          >
            Import
          </Tab>
          <Tab
            value="settings"
            sx={{
              borderRadius: 'xs',
              fontWeight: 600,
              fontSize: '0.85rem',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              '&[aria-selected="true"]': {
                bgcolor: 'background.level2',
                color: 'primary.400',
              },
            }}
          >
            Settings
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
        <TabPanel value="settings" sx={{ p: 0 }}>
          <Settings />
        </TabPanel>
      </Tabs>
    </Box>
  );
};
