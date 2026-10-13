import { Users } from 'lucide-react';
import { initials } from '../utils/format';

export function Avatar({ name, id = 0, size = 'normal', online = false, group = false, emoji }: {
    name: string;
    id?: number;
    size?: 'small' | 'normal' | 'large';
    online?: boolean;
    group?: boolean;
    emoji?: string;
}) {
    return <div className={`avatar avatar-${Math.abs(id) % 6} avatar-${size} ${group ? 'group-avatar' : ''} ${emoji ? 'emoji-avatar' : ''}`}>{group ? <Users size={size === 'large' ? 25 : 19}/> : emoji || initials(name)}{online && <i className="presence-dot"/>}</div>;
}
