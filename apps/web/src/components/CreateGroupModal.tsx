import type { FormEvent, Dispatch, SetStateAction } from 'react';
import { Users, X } from 'lucide-react';
import { Avatar } from './Avatar';
import type { Group, User } from '../types';

type CreateGroupModalProps = {
  users: User[];
  groupCount: number;
  groupName: string;
  setGroupName: Dispatch<SetStateAction<string>>;
  groupDescription: string;
  setGroupDescription: Dispatch<SetStateAction<string>>;
  selectedMembers: number[];
  setSelectedMembers: Dispatch<SetStateAction<number[]>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

export function CreateGroupModal({
  users,
  groupCount,
  groupName,
  setGroupName,
  groupDescription,
  setGroupDescription,
  selectedMembers,
  setSelectedMembers,
  onSubmit,
  onClose,
}: CreateGroupModalProps) {
  const toggleMember = (userId: number, checked: boolean) => {
    setSelectedMembers((current) =>
      checked ? [...current, userId] : current.filter((id) => id !== userId),
    );
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form className="modal group-modal" onSubmit={onSubmit}>
        <header className="modal-header">
          <div>
            <span className="modal-kicker">ОБЩАЙТЕСЬ ВМЕСТЕ</span>
            <h2>Новая группа</h2>
          </div>
          <button type="button" className="round-button subtle" aria-label="Закрыть форму" onClick={onClose}>
            <X size={19} />
          </button>
        </header>

        <div className="group-preview">
          <Avatar name={groupName || 'Новая группа'} id={groupCount + 3} group size="large" />
          <div>
            <strong>{groupName || 'Название группы'}</strong>
            <span>{selectedMembers.length + 1} участника, включая тебя</span>
          </div>
        </div>

        <label>
          Название группы
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            minLength={2}
            maxLength={48}
            placeholder="Например, Наши друзья"
            required
          />
        </label>
        <label>
          Описание <span className="optional-label">необязательно</span>
          <textarea
            value={groupDescription}
            onChange={(event) => setGroupDescription(event.target.value)}
            maxLength={180}
            rows={2}
            placeholder="О чём эта группа?"
          />
        </label>

        <div className="member-picker">
          <div className="member-picker-heading">
            <strong>Добавить участников</strong>
            <span>{selectedMembers.length} выбрано</span>
          </div>
          <div className="member-list">
            {users.length ? users.map((user) => (
              <label key={user.id} className="member-option">
                <Avatar name={user.displayName || user.username} id={user.id} size="small" />
                <span>
                  <strong>{user.displayName || user.username}</strong>
                  <small>@{user.username}</small>
                </span>
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(user.id)}
                  onChange={(event) => toggleMember(user.id, event.target.checked)}
                />
              </label>
            )) : (
              <p className="no-members">
                Пока нет других пользователей. Можно создать группу и пригласить участников позже.
              </p>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Отмена</button>
          <button type="submit" className="primary-button"><Users size={17} /> Создать группу</button>
        </div>
      </form>
    </div>
  );
}
