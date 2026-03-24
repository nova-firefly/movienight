import React from 'react';
import { Box, Tabs, TabList, Tab, TabPanel, Typography } from '@mui/joy';
import { UserManagement } from './UserManagement';
import { AuditLog } from './AuditLog';
import { LoginHistory } from './LoginHistory';

export const AdminPanel: React.FC = () => {
  return (
    <Box>
      <Typography
        level="h3"
        sx={{ fontWeight: 800, mb: 3, letterSpacing: '-0.02em' }}
      >
        Admin
      </Typography>
      <Tabs
        defaultValue="users"
        sx={{ bgcolor: 'transparent' }}
      >
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
          }}
        >
          <Tab
            value="users"
            sx={{
              borderRadius: 'xs',
              fontWeight: 600,
              fontSize: '0.85rem',
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
              '&[aria-selected="true"]': {
                bgcolor: 'background.level2',
                color: 'primary.400',
              },
            }}
          >
            Login History
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
      </Tabs>
    </Box>
  );
};
