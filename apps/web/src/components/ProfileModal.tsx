import { MessageCircle, Settings, ShieldCheck, X } from 'lucide-react';
import { Avatar } from './Avatar';
import type { User } from '../types';

type ProfileModalProps = {
  user: User;
  currentUserId: number;
  onClose: () => void;
  onMessage: (user: User) => void;
  onSettings: () => void;
};

export function ProfileModal({ user, currentUserId, onClose, onMessage, onSettings }: ProfileModalProps) {
  const isCurrentUser = user.id === currentUserId;
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
          <Avatar name={displayName} id={user.id} size="large" online />
          <span className="profile-online"><i /> В Stychat</span>
          <h2 id="profile-title">{displayName}</h2>
          <p className="profile-username">@{user.username}</p>
          <p className="profile-status">{user.status || 'Пока без статуса'}</p>
          <div className="profile-facts">
            <div><MessageCircle size={17} /><span>Личные сообщения</span></div>
            <div><ShieldCheck size={17} /><span>Пользователь Stychat</span></div>
          </div>
          {isCurrentUser ? (
            <button className="primary-button profile-message" onClick={onSettings}>
              <Settings size={17} /> Настроить профиль
            </button>
          ) : (
            <button className="primary-button profile-message" onClick={() => onMessage(user)}>
              <MessageCircle size={17} /> Написать сообщение
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
