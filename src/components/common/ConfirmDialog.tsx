import React from 'react';
import { Modal, ModalDialog, Typography, Button, Box, Divider } from '@mui/joy';
import { AlertTriangle, CheckCircle, Info, LucideIcon } from 'lucide-react';

export type ConfirmColor = 'danger' | 'primary' | 'warning' | 'success';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: ConfirmColor;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ICONS: Record<ConfirmColor, LucideIcon> = {
  danger: AlertTriangle,
  warning: AlertTriangle,
  success: CheckCircle,
  primary: Info,
};

const ICON_BG: Record<ConfirmColor, string> = {
  danger: 'var(--joy-palette-danger-softBg)',
  warning: 'var(--joy-palette-warning-softBg)',
  success: 'var(--joy-palette-success-softBg)',
  primary: 'var(--joy-palette-primary-softBg)',
};

const ICON_COLOR: Record<ConfirmColor, string> = {
  danger: 'var(--joy-palette-danger-softColor)',
  warning: 'var(--joy-palette-warning-softColor)',
  success: 'var(--joy-palette-success-softColor)',
  primary: 'var(--joy-palette-primary-softColor)',
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const isDestructive = confirmColor === 'danger' || confirmColor === 'warning';
  const Icon = ICONS[confirmColor];
  return (
    <Modal open={open} onClose={onCancel}>
      <ModalDialog
        role="alertdialog"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        sx={{
          maxWidth: 400,
          width: '100%',
          p: 3,
          bgcolor: 'background.level1',
          borderColor: 'var(--mn-border-vis)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 0.5 }}>
          {isDestructive && (
            <Box
              aria-hidden="true"
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: ICON_BG[confirmColor],
                color: ICON_COLOR[confirmColor],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon size={18} strokeWidth={2.25} />
            </Box>
          )}
          <Typography
            id="confirm-dialog-title"
            level="title-md"
            sx={{ fontWeight: 700, pt: isDestructive ? 0.5 : 0 }}
          >
            {title}
          </Typography>
        </Box>
        <Typography
          id="confirm-dialog-message"
          level="body-sm"
          sx={{ color: 'text.secondary', mb: 2, ml: isDestructive ? 5.5 : 0 }}
        >
          {message}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button variant="plain" color="neutral" onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant="solid"
            color={confirmColor}
            onClick={onConfirm}
            loading={loading}
            sx={{
              fontWeight: 700,
            }}
          >
            {confirmText}
          </Button>
        </Box>
      </ModalDialog>
    </Modal>
  );
};

export default ConfirmDialog;
