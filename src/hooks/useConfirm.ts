import { useState, useCallback, useRef, useEffect } from 'react';
import { ConfirmDialogProps } from '../components/common/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'danger' | 'primary' | 'warning' | 'success';
}

export function useConfirm() {
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: 'danger' | 'primary' | 'warning' | 'success';
  }>({
    open: false,
    title: '',
    message: '',
  });

  // Resolve false on unmount to prevent dangling promises
  useEffect(() => {
    return () => {
      if (resolveRef.current) {
        resolveRef.current(false);
        resolveRef.current = null;
      }
    };
  }, []);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialogState({ open: true, ...options });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setDialogState((s) => ({ ...s, open: false }));
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setDialogState((s) => ({ ...s, open: false }));
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  const dialogProps: ConfirmDialogProps = {
    open: dialogState.open,
    title: dialogState.title,
    message: dialogState.message,
    confirmText: dialogState.confirmText,
    cancelText: dialogState.cancelText,
    confirmColor: dialogState.confirmColor,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
  };

  return { confirm, dialogProps };
}
