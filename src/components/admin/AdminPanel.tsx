import React from 'react';
import { Tabs, TabList, Tab, TabPanel } from '@mui/joy';
import { UserManagement } from './UserManagement';
import { AuditLog } from './AuditLog';
import { LoginHistory } from './LoginHistory';

export const AdminPanel: React.FC = () => {
  return (
    <Tabs defaultValue="users" sx={{ bgcolor: 'transparent' }}>
      <TabList>
        <Tab value="users">Users</Tab>
        <Tab value="audit">Audit Log</Tab>
        <Tab value="logins">Login History</Tab>
      </TabList>
      <TabPanel value="users" sx={{ pt: 3 }}>
        <UserManagement />
      </TabPanel>
      <TabPanel value="audit" sx={{ pt: 3 }}>
        <AuditLog />
      </TabPanel>
      <TabPanel value="logins" sx={{ pt: 3 }}>
        <LoginHistory />
      </TabPanel>
    </Tabs>
  );
};
