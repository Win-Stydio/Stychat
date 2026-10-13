import { useState, type FormEvent } from 'react';
import { CheckCircle2, LogOut, Moon, Settings, ShieldCheck, Sun, X } from 'lucide-react';
import { Avatar } from './Avatar';
import type { Session } from '../types';

type SettingsModalProps = {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  session: Session;
  profileName: string;
  setProfileName: (value: string) => void;
  profileStatus: string;
  setProfileStatus: (value: string) => void;
  avatarEmoji: string;
  setAvatarEmoji: (value: string) => void;
  onSaveProfile: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  onSignOut: () => void;
  initialSection?: 'profile' | 'general';
};

export function SettingsModal({
  theme,
  setTheme,
  session,
  profileName,
  setProfileName,
  profileStatus,
  setProfileStatus,
  avatarEmoji,
  setAvatarEmoji,
  onSaveProfile,
  onClose,
  onSignOut,
  initialSection = 'general',
}: SettingsModalProps) {
  const [section, setSection] = useState<'profile' | 'general'>(initialSection);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="modal-header">
          <div>
            <span className="modal-kicker">ПЕРСОНАЛИЗАЦИЯ</span>
            <h2 id="settings-title">Настройки Stychat</h2>
          </div>
          <button className="round-button subtle" type="button" aria-label="Закрыть настройки" onClick={onClose}>
            <X size={19} />
          </button>
        </header>

        <div className="settings-tabs"><button type="button" className={section === 'profile' ? 'active' : ''} onClick={() => setSection('profile')}>🙂 Мой профиль</button><button type="button" className={section === 'general' ? 'active' : ''} onClick={() => setSection('general')}>⚙ Общие</button></div>

        {section === 'general' && <div className="settings-section">
          <h3>Внешний вид</h3>
          <p>Выбери оформление, которое тебе комфортно.</p>
          <div className="theme-options">
            <button
              type="button"
              className={theme === 'light' ? 'theme-choice chosen' : 'theme-choice'}
              onClick={() => setTheme('light')}
            >
              <div className="theme-preview light-preview"><span /><span /><i /></div>
              <span><Sun size={16} /> Светлая</span>
              {theme === 'light' && <CheckCircle2 size={17} />}
            </button>
            <button
              type="button"
              className={theme === 'dark' ? 'theme-choice chosen' : 'theme-choice'}
              onClick={() => setTheme('dark')}
            >
              <div className="theme-preview dark-preview"><span /><span /><i /></div>
              <span><Moon size={16} /> Тёмная</span>
              {theme === 'dark' && <CheckCircle2 size={17} />}
            </button>
          </div>
        </div>}

        {section === 'profile' && <form onSubmit={onSaveProfile} className="settings-section profile-settings">
          <h3>Мой профиль</h3>
          <p>Так тебя будут видеть другие пользователи.</p>
          <div className="settings-profile-preview">
            <Avatar name={profileName || session.user.username} id={session.user.id} size="large" online emoji={avatarEmoji} />
            <div>
              <strong>{profileName || session.user.username}</strong>
              <span>@{session.user.username}</span>
            </div>
          </div>
          <div className="avatar-picker-field"><strong>Аватар-смайлик</strong><p>Выбери эмодзи, который будет виден в списке контактов и чатах.</p><div className="avatar-emoji-grid">{['🙂','😀','😎','🥹','😍','🤓','😴','🤠','🦊','🐱','🐼','🐸','🐧','🦄','🐙','🐻','🌻','🍀','🍓','🌈','⭐','🚀','🎧','💚'].map(emoji => <button type="button" key={emoji} className={avatarEmoji === emoji ? 'selected' : ''} aria-label={`Аватар ${emoji}`} onClick={() => setAvatarEmoji(emoji)}>{emoji}</button>)}</div></div>
          <label>
            Отображаемое имя
            <input
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              minLength={1}
              maxLength={32}
              required
            />
          </label>
          <label>
            Статус
            <input
              value={profileStatus}
              onChange={(event) => setProfileStatus(event.target.value)}
              maxLength={80}
              placeholder="Например, на связи"
            />
          </label>
          <button className="primary-button" type="submit">Сохранить профиль</button>
        </form>}

        <div className="settings-section settings-bottom">
          <div className="settings-about">
            <ShieldCheck size={19} />
            <div>
              <strong>Stychat от Win Stydio</strong>
              <span>Версия 1.6.0 · Ваши разговоры, ваш круг</span>
            </div>
          </div>
          <button className="logout-button" type="button" onClick={onSignOut}>
            <LogOut size={17} /> Выйти из аккаунта
          </button>
        </div>
      </section>
    </div>
  );
}
