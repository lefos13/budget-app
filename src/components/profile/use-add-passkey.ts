'use client';

import { useState, useCallback } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { translateApiError } from '@/lib/i18n/api-errors';

export function useAddPasskey() {
  const [isAdding, setIsAdding] = useState(false);
  const { showToast } = useApp();
  const { t } = useTranslation();

  const addPasskey = useCallback(
    async (onSuccess?: () => void | Promise<void>): Promise<boolean> => {
      setIsAdding(true);
      try {
        const optRes = await fetch('/api/auth/passkey/register/options', {
          method: 'POST',
          credentials: 'include',
        });
        if (!optRes.ok) {
          const errData = await optRes.json().catch(() => ({}));
          showToast(translateApiError(errData.error, optRes.status, t));
          return false;
        }
        const optionsJSON = await optRes.json();

        let attResp;
        try {
          attResp = await startRegistration({ optionsJSON });
        } catch (err: unknown) {
          const error = err as { name?: string; message?: string };
          if (error?.name === 'NotAllowedError') {
            // User cancelled the prompt quietly
            return false;
          }
          if (error?.name === 'InvalidStateError') {
            showToast(t.passkeys.alreadyRegistered);
            return false;
          }
          showToast(error?.message || t.passkeys.genericError);
          return false;
        }

        const verifyRes = await fetch('/api/auth/passkey/register/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(attResp),
        });

        if (!verifyRes.ok) {
          const errData = await verifyRes.json().catch(() => ({}));
          showToast(translateApiError(errData.error, verifyRes.status, t));
          return false;
        }

        showToast(t.passkeys.createdToast);
        if (onSuccess) {
          await onSuccess();
        }
        return true;
      } catch (err) {
        console.error('Error during passkey registration:', err);
        showToast(t.passkeys.genericError);
        return false;
      } finally {
        setIsAdding(false);
      }
    },
    [showToast, t]
  );

  return { isAdding, addPasskey };
}
