import { useState, type FormEvent } from 'react';
import { MessageCircle, ShieldCheck, X } from 'lucide-react';
import { Avatar } from './Avatar';
import type { User } from '../types';

type ProfileModalProps = {
  user: User;
  currentUserId: number;
  profileName: string;
  setProfileName: (value: string) => void;
  profileStatus: string;
  setProfileStatus: (value: string) => void;
  avatarEmoji: string;
  setAvatarEmoji: (value: string) => void;
  onSaveProfile: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  onMessage: (user: User) => void;
};

const avatarOptions = ['🙂','😀','😎','🥹','😍','🤓','😴','🤠','🦊','🐱','🐼','🐸','🐧','🦄','🐙','🐻','🌻','🍀','🍓','🌈','⭐','🚀','🎧','💚'];

export function ProfileModal({
  user, currentUserId, profileName, setProfileName, profileStatus,
  setProfileStatus, avatarEmoji, setAvatarEmoji, onSaveProfile, onClose, onMessage,
}: ProfileModalProps) {
  const isCurrentUser = user.id === currentUserId;
  const [editing, setEditing] = useState(false);
  const displayName = user.displayName || user.username;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <button className="modal-close-float" type="button" aria-label="Закрыть профиль" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="profile-cover">
          <div className="cover-orb orb-left" />
          <div className="cover-orb orb-right" />
        </div>
        <div className="profile-card-content">
          {isCurrentUser && editing ? (
            <form className="profile-editor" onSubmit={(event) => {
              onSaveProfile(event);
              setEditing(false);
            }}>
              <Avatar name={profileName || user.username} id={user.id} size="large" online emoji={avatarEmoji} />
              <h2 id="profile-title">Редактирование профиля</h2>
              <label>Аватар-смайлик</label>
              <div className="avatar-emoji-grid">
                {avatarOptions.map((emoji) => (
                  <button type="button" key={emoji} className={avatarEmoji === emoji ? 'selected' : ''} aria-label={`Аватар ${emoji}`} onClick={() => setAvatarEmoji(emoji)}>{emoji}</button>
                ))}
              </div>
              <label>Отображаемое имя
                <input value={profileName} onChange={(event) => setProfileName(event.target.value)} minLength={1} maxLength={32} required />
              </label>
              <label>Статус
                <input value={profileStatus} onChange={(event) => setProfileStatus(event.target.value)} maxLength={80} placeholder="Например, на связи" />
              </label>
              <button className="primary-button profile-message" type="submit">Сохранить профиль</button>
              <button className="secondary-button" type="button" onClick={() => setEditing(false)}>Отмена</button>
            </form>
          ) : (
            <>
              <Avatar name={displayName} id={user.id} size="large" online emoji={user.avatarEmoji} />
              <span className="profile-online"><i /> В Stychat</span>
              <h2 id="profile-title">{displayName}</h2>
              <p className="profile-username">@{user.username}</p>
              <p className="profile-status">{user.status || 'Пока без статуса'}</p>
              <div className="profile-facts">
                <div><MessageCircle size={17} /><span>Личные сообщения</span></div>
                <div><ShieldCheck size={17} /><span>Пользователь Stychat</span></div>
              </div>
              {isCurrentUser ? (
                <button className="primary-button profile-message" type="button" onClick={() => setEditing(true)}>Редактировать профиль</button>
              ) : (
                <button className="primary-button profile-message" type="button" onClick={() => onMessage(user)}>
                  <MessageCircle size={17} /> Написать сообщение
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
