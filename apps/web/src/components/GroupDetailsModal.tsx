import { useEffect, useState } from 'react';
import { Crown, Info, Users, X } from 'lucide-react';
import { Avatar } from './Avatar';
import { request } from '../lib/api';
import type { Group, GroupMember } from '../types';
type GroupDetailsModalProps = {
    group: Group;
    token: string;
    onClose: () => void;
    onOpenProfile: (user: GroupMember) => void;
};
type GroupMembersResponse = {
    members: GroupMember[];
};
export function GroupDetailsModal({ group, token, onClose, onOpenProfile, }: GroupDetailsModalProps) {
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        request<GroupMembersResponse>(`/api/groups/${group.id}/members`, token)
            .then((result) => {
            if (active)
                setMembers(result.members);
        })
            .catch((reason: unknown) => {
            if (active) {
                setError(reason instanceof Error
                    ? reason.message
                    : 'Не удалось загрузить участников группы.');
            }
        })
            .finally(() => {
            if (active)
                setLoading(false);
        });
        return () => {
            active = false;
        };
    }, [group.id, token]);
    return (<div className="modal-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget)
                onClose();
        }}>
      <section className="modal group-details-modal" role="dialog" aria-modal="true" aria-labelledby="group-details-title">
        <header className="modal-header">
          <div>
            <span className="modal-kicker">ВАШ КРУГ ОБЩЕНИЯ</span>
            <h2 id="group-details-title">Информация о группе</h2>
          </div>
          <button className="round-button subtle" type="button" aria-label="Закрыть информацию о группе" onClick={onClose}>
            <X size={19}/>
          </button>
        </header>

        <div className="group-preview">
          <Avatar name={group.name} id={group.id} group size="large"/>
          <div>
            <strong>{group.name}</strong>
            <span>{group.description || 'Групповой чат Stychat'}</span>
          </div>
        </div>

        <div className="group-details-summary">
          <Info size={17}/>
          <span>{group.memberCount} участника{group.memberCount === 1 ? '' : 'ов'}</span>
        </div>

        <div className="member-picker group-details-members">
          <div className="member-picker-heading">
            <strong>Участники</strong>
            <span>{members.length}</span>
          </div>
          {loading ? (<p className="group-details-message">Загружаем список участников…</p>) : error ? (<p className="group-details-message error-text">{error}</p>) : members.length ? (<div className="member-list">
              {members.map((member) => (<button key={member.id} type="button" className="member-option group-member-button" onClick={() => onOpenProfile(member)}>
                  <Avatar name={member.displayName || member.username} id={member.id} size="small"/>
                  <span>
                    <strong>{member.displayName || member.username}</strong>
                    <small>@{member.username}</small>
                  </span>
                  {member.role === 'owner' && (<span className="group-owner-label" title="Создатель группы">
                      <Crown size={14}/> Создатель
                    </span>)}
                </button>))}
            </div>) : (<p className="group-details-message">Список участников пуст.</p>)}
        </div>

        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </section>
    </div>);
}
