import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { ApiFailure, api } from '../app/api';
import { useT } from '../app/i18n';
import { forgetLearner, useMe } from '../app/queries';
import { Button, Field, Notice, TextInput } from '../ui';

export function Login() {
  const t = useT();
  const client = useQueryClient();
  // An instance with one account signs in with a password alone, as it always did.
  const named = useMe().data?.hasUsers ?? false;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/login', named ? { username, password } : { password });
      await forgetLearner(client);
    } catch (failure) {
      if (failure instanceof ApiFailure && failure.status === 429)
        setError(
          t('Příliš mnoho pokusů. Chvíli počkej a zkus to znovu.', 'Too many attempts. Wait a moment and try again.'),
        );
      else if (failure instanceof ApiFailure && failure.status === 401)
        setError(
          named
            ? t('Jméno nebo heslo nesedí.', 'The name or the password is not right.')
            : t('Tohle heslo nesedí.', 'That password is not right.'),
        );
      else setError(t('Server neodpovídá.', 'The server is not responding.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="mb-6">
          <div className="text-2xl font-semibold tracking-tight">Lemma</div>
          <div className="mono-label mt-1">{t('matematická laboratoř', 'mathematics laboratory')}</div>
        </div>
        {named && (
          <Field label={t('Jméno', 'Name')} className="mb-3">
            <TextInput
              autoFocus
              autoComplete="username"
              autoCapitalize="off"
              spellCheck={false}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </Field>
        )}
        <Field label={t('Heslo', 'Password')}>
          <TextInput
            type="password"
            autoFocus={!named}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {error && (
          <Notice tone="serious" className="mt-3">
            {error}
          </Notice>
        )}
        <Button
          type="submit"
          variant="primary"
          className="mt-4 w-full"
          busy={busy}
          disabled={password === '' || (named && username.trim() === '')}
        >
          {t('Přihlásit se', 'Sign in')}
        </Button>
      </form>
    </div>
  );
}
