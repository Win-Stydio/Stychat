import type { FormEvent } from 'react';
import { MessageCircle, ShieldCheck } from 'lucide-react';

type AuthScreenProps = {
  theme: 'light' | 'dark';
  authMode: 'login' | 'register';
  setAuthMode: (mode: 'login' | 'register') => void;
  username: string;
  setUsername: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  authError: string;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AuthScreen({
  theme,
  authMode,
  setAuthMode,
  username,
  setUsername,
  password,
  setPassword,
  authError,
  busy,
  onSubmit,
}: AuthScreenProps) {
  const registering = authMode === 'register';

  return (
    <main className="auth-shell" data-theme={theme}>
      <div className="auth-card">
        <div className="brand-lockup">
          <div className="brand-mark">
            <MessageCircle size={25} />
          </div>
          <div>
            <div className="brand-name">
              stychat<span>.</span>
            </div>
            <div className="brand-byline">BY WIN STYDIO</div>
          </div>
        </div>

        <div className="auth-eyebrow">YOUR PEOPLE, YOUR SPACE</div>
        <h1>
          {registering ? (
            <>
              Общаться —<br />
              <span>просто.</span>
            </>
          ) : (
            <>
              С возвращением
              <br />
              <span>в Stychat.</span>
            </>
          )}
        </h1>
        <p className="auth-subtitle">
          Личные разговоры, друзья и группы в одном месте.
        </p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            Имя пользователя
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="например, greenfox"
              minLength={3}
              maxLength={20}
              required
            />
          </label>
          <label>
            Пароль
            <input
              autoComplete={registering ? 'new-password' : 'current-password'}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Минимум 8 символов"
              minLength={8}
              required
            />
          </label>
          {authError && <div className="error-box">{authError}</div>}
          <button className="primary-button" disabled={busy}>
            {busy ? 'Секунду…' : registering ? 'Создать аккаунт' : 'Войти'}
            <span>↗</span>
          </button>
        </form>

        <div className="auth-switch">
          {registering ? 'Уже есть аккаунт?' : 'Впервые здесь?'}
          <button
            type="button"
            onClick={() => {
              setAuthMode(registering ? 'login' : 'register');
            }}
          >
            {registering ? 'Войти' : 'Создать аккаунт'}
          </button>
        </div>
        <div className="auth-footer">
          <ShieldCheck size={14} /> Stychat от Win Stydio <span>·</span> VERSION 1.5.0
        </div>
      </div>
    </main>
  );
}
