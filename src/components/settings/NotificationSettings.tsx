import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  Box,
  Button,
  Card,
  Divider,
  Modal,
  ModalClose,
  ModalDialog,
  Switch,
  Typography,
} from '@mui/joy';
import {
  GET_APP_INFO,
  GET_NOTIFICATION_PREFERENCES,
  SUBSCRIBE_PUSH,
  UNSUBSCRIBE_PUSH,
  UPDATE_NOTIFICATION_PREFERENCE,
} from '../../graphql/queries';
import {
  getCurrentSubscription,
  iosVersion,
  isStandalonePWA,
  pushSupported,
  registerServiceWorker,
  subscribeForPush,
  unsubscribeFromPush,
} from '../../utils/pushClient';
import { useToast } from '../../contexts/ToastContext';

interface NotificationPreference {
  eventType: string;
  enabled: boolean;
}

const EVENT_LABELS: Record<string, string> = {
  MOVIE_ADD: 'New movies added by others',
};

type SupportState = 'unsupported' | 'ios-too-old' | 'ios-not-installed' | 'ok';

function detectSupportState(): SupportState {
  if (!pushSupported()) return 'unsupported';
  const ios = iosVersion();
  if (ios !== null) {
    if (ios < 16.4) return 'ios-too-old';
    if (!isStandalonePWA()) return 'ios-not-installed';
  }
  return 'ok';
}

export const NotificationSettings: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [supportState, setSupportState] = useState<SupportState>('ok');
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: appInfoData } = useQuery(GET_APP_INFO);
  const { data: prefsData, refetch: refetchPrefs } = useQuery(GET_NOTIFICATION_PREFERENCES);
  const [subscribePushMutation] = useMutation(SUBSCRIBE_PUSH);
  const [unsubscribePushMutation] = useMutation(UNSUBSCRIBE_PUSH);
  const [updatePreferenceMutation] = useMutation(UPDATE_NOTIFICATION_PREFERENCE);

  const vapidPublicKey: string | null = appInfoData?.appInfo?.vapidPublicKey ?? null;
  const prefs: NotificationPreference[] = prefsData?.notificationPreferences ?? [];

  useEffect(() => {
    setSupportState(detectSupportState());
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
    (async () => {
      const sub = await getCurrentSubscription();
      setSubscribed(!!sub);
    })();
  }, []);

  const handleEnable = async () => {
    if (!vapidPublicKey) {
      showError("Push notifications aren't configured on this server.");
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        showError('Notification permission denied.');
        return;
      }
      const reg = await registerServiceWorker();
      if (!reg) {
        showError('Could not register service worker.');
        return;
      }
      const subscription = await subscribeForPush(vapidPublicKey);
      if (!subscription) {
        showError('Could not subscribe to push notifications.');
        return;
      }
      await subscribePushMutation({ variables: { subscription } });
      setSubscribed(true);
      showSuccess('Notifications enabled on this device.');
    } catch (err) {
      console.error(err);
      showError('Failed to enable notifications.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) {
        await unsubscribePushMutation({ variables: { endpoint } });
      }
      setSubscribed(false);
      showSuccess('Notifications disabled on this device.');
    } catch (err) {
      console.error(err);
      showError('Failed to disable notifications.');
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePreference = async (eventType: string, enabled: boolean) => {
    try {
      await updatePreferenceMutation({ variables: { eventType, enabled } });
      await refetchPrefs();
    } catch (err) {
      console.error(err);
      showError('Failed to update preference.');
    }
  };

  return (
    <Box>
      <Typography level="title-md" sx={{ fontWeight: 700, mb: 0.5 }}>
        This device
      </Typography>
      <DeviceCard
        supportState={supportState}
        permission={permission}
        subscribed={subscribed}
        busy={busy}
        vapidConfigured={!!vapidPublicKey}
        onEnable={handleEnable}
        onDisable={handleDisable}
      />

      <Divider sx={{ my: 2.5 }} />

      <Typography level="title-md" sx={{ fontWeight: 700, mb: 1 }}>
        What to notify me about
      </Typography>
      <Card variant="outlined" sx={{ p: 2, bgcolor: 'background.level1' }}>
        {prefs.map((pref) => (
          <Box
            key={pref.eventType}
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}
          >
            <Typography level="body-md">
              {EVENT_LABELS[pref.eventType] ?? pref.eventType}
            </Typography>
            <Switch
              checked={pref.enabled}
              onChange={(e) => handleTogglePreference(pref.eventType, e.target.checked)}
            />
          </Box>
        ))}
      </Card>
    </Box>
  );
};

interface DeviceCardProps {
  supportState: SupportState;
  permission: NotificationPermission;
  subscribed: boolean;
  busy: boolean;
  vapidConfigured: boolean;
  onEnable: () => void;
  onDisable: () => void;
}

const DeviceCard: React.FC<DeviceCardProps> = ({
  supportState,
  permission,
  subscribed,
  busy,
  vapidConfigured,
  onEnable,
  onDisable,
}) => {
  if (supportState === 'unsupported') {
    return (
      <Card variant="outlined" sx={{ p: 2, bgcolor: 'background.level1' }}>
        <Typography level="body-md">
          Push notifications aren’t supported in this browser.
        </Typography>
      </Card>
    );
  }

  if (supportState === 'ios-too-old') {
    return (
      <Card variant="outlined" sx={{ p: 2, bgcolor: 'background.level1' }}>
        <Typography level="body-md">Push notifications need iOS 16.4 or later.</Typography>
      </Card>
    );
  }

  if (supportState === 'ios-not-installed') {
    return (
      <Card variant="outlined" sx={{ p: 2, bgcolor: 'background.level1' }}>
        <Typography level="body-md" sx={{ fontWeight: 600, mb: 1 }}>
          Add MovieNight to your Home Screen
        </Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
          On iPhone, notifications only work when the app is launched from the Home Screen. Tap the
          Share button in Safari, choose <strong>Add to Home Screen</strong>, then open MovieNight
          from the new icon and return here.
        </Typography>
      </Card>
    );
  }

  if (!vapidConfigured) {
    return (
      <Card variant="outlined" sx={{ p: 2, bgcolor: 'background.level1' }}>
        <Typography level="body-md">
          Push notifications aren’t configured on this server.
        </Typography>
      </Card>
    );
  }

  if (permission === 'denied') {
    return (
      <Card variant="outlined" sx={{ p: 2, bgcolor: 'background.level1' }}>
        <Typography level="body-md" sx={{ mb: 1 }}>
          Notifications are blocked in your device settings.
        </Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
          On iOS: Settings → MovieNight → Notifications → Allow Notifications.
        </Typography>
      </Card>
    );
  }

  if (subscribed && permission === 'granted') {
    return (
      <Card variant="outlined" sx={{ p: 2, bgcolor: 'background.level1' }}>
        <Typography level="body-md" sx={{ mb: 1.5 }}>
          ✓ Notifications enabled on this device.
        </Typography>
        <Button color="primary" variant="outlined" loading={busy} onClick={onDisable}>
          Disable
        </Button>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ p: 2, bgcolor: 'background.level1' }}>
      <Typography level="body-md" sx={{ mb: 1.5 }}>
        Get a notification on this device when someone adds a movie.
      </Typography>
      <Button color="primary" variant="solid" loading={busy} onClick={onEnable}>
        Turn on notifications
      </Button>
    </Card>
  );
};

interface NotificationSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  open,
  onClose,
}) => (
  <Modal open={open} onClose={onClose}>
    <ModalDialog
      sx={{
        maxWidth: 460,
        width: '100%',
        p: 3,
        bgcolor: 'background.level1',
        borderColor: 'var(--mn-border-vis)',
      }}
    >
      <ModalClose aria-label="Close notification settings" />
      <Typography level="title-lg" sx={{ fontWeight: 800, mb: 2 }}>
        Notifications
      </Typography>
      <NotificationSettings />
    </ModalDialog>
  </Modal>
);
