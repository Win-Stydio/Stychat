import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { ArrowLeft, Bell, Check, CheckCheck, ChevronDown, CircleHelp, ImagePlus, Info, LogOut, MessageCircle, MoreHorizontal, Moon, Plus, Search, Send, Settings, ShieldCheck, Smile, Sun, Users, UserRound, UserRoundPlus, X, CheckCircle2, Circle, PanelLeftClose } from 'lucide-react';
import { Avatar } from './components/Avatar';
import { AuthScreen } from './components/AuthScreen';
import { CreateGroupModal } from './components/CreateGroupModal';
import { GroupDetailsModal } from './components/GroupDetailsModal';
import { ProfileModal } from './components/ProfileModal';
import { SettingsModal } from './components/SettingsModal';
import { API, request } from './lib/api';
import { timeLabel } from './utils/format';
import type { User, Message, Group, GroupMessage, Session, Tab } from './types';
export default function App() {
    const [session, setSession] = useState<Session | null>(() => {
        try {
            const s = localStorage.getItem('stychat-session');
            return s ? JSON.parse(s) as Session : null;
        }
        catch {
            return null;
        }
    });
    const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('stychat-theme') === 'dark' ? 'dark' : 'light');
    const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [busy, setBusy] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [activeUser, setActiveUser] = useState<User | null>(null);
    const [activeGroup, setActiveGroup] = useState<Group | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [hasMoreGroupMessages, setHasMoreGroupMessages] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [tab, setTab] = useState<Tab>('chats');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [unread, setUnread] = useState<Record<number, number>>({});
    const [socketReady, setSocketReady] = useState(false);
    const [typingUser, setTypingUser] = useState<number | null>(null);
    const [pageError, setPageError] = useState('');
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsSection, setSettingsSection] = useState<'profile' | 'general'>('general');
    const [profileOpen, setProfileOpen] = useState<User | null>(null);
    const [createGroupOpen, setCreateGroupOpen] = useState(false);
    const [groupInfoOpen, setGroupInfoOpen] = useState(false);
    const [profileName, setProfileName] = useState('');
    const [profileStatus, setProfileStatus] = useState('');
    const [avatarEmoji, setAvatarEmoji] = useState('🙂');
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const mediaInputRef = useRef<HTMLInputElement | null>(null);
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
    const [messageSearch, setMessageSearch] = useState('');
    const [searchResults, setSearchResults] = useState<Message[]>([]);
    const socketRef = useRef<Socket | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const conversationBodyRef = useRef<HTMLDivElement | null>(null);
    const shouldAutoScrollRef = useRef(true);
    const historyRestoreRef = useRef<{ height: number; top: number } | null>(null);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeIdRef = useRef<number | null>(null);
    const activeGroupIdRef = useRef<number | null>(null);
    activeIdRef.current = activeUser?.id ?? null;
    activeGroupIdRef.current = activeGroup?.id ?? null;
    const signOut = useCallback(() => { socketRef.current?.disconnect(); socketRef.current = null; localStorage.removeItem('stychat-session'); setSession(null); setActiveUser(null); setActiveGroup(null); setUsers([]); setGroups([]); setMessages([]); setGroupMessages([]); setDrafts({}); setSocketReady(false); setSettingsOpen(false); }, []);
    useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('stychat-theme', theme); }, [theme]);
    const loadDirectory = useCallback(async (token: string) => {
        const [userData, groupData, unreadData] = await Promise.all([
            request<{
                users: User[];
            }>('/api/users', token), request<{
                groups: Group[];
            }>('/api/groups', token), request<{
                unread: Record<number, number>;
            }>('/api/unread', token)
        ]);
        setUsers(userData.users);
        setGroups(groupData.groups);
        setUnread(unreadData.unread);
    }, []);
    useEffect(() => {
        if (!session)
            return;
        let alive = true;
        loadDirectory(session.token).catch(e => {
            if (alive) {
                setPageError(e.message);
                if (String(e.message).toLowerCase().includes('session'))
                    signOut();
            }
        });
        const socket = io(API, { auth: { token: session.token }, reconnection: true });
        socketRef.current = socket;
        socket.on('connect', () => setSocketReady(true));
        socket.on('disconnect', () => setSocketReady(false));
        socket.on('connect_error', (e) => setPageError(e.message || 'Не удалось подключиться к серверу.'));
        socket.on('profile:updated', (updated: User) => {
            setUsers(current => current.map(u => u.id === updated.id ? updated : u));
            if (updated.id === session.user.id)
                setSession(current => {
                    if (!current)
                        return current;
                    const next = { ...current, user: updated };
                    localStorage.setItem('stychat-session', JSON.stringify(next));
                    return next;
                });
            setActiveUser(current => current?.id === updated.id ? updated : current);
            setProfileOpen(current => current?.id === updated.id ? updated : current);
        });
        socket.on('groups:updated', (updated: Group) => setGroups(current => current.some(g => g.id === updated.id) ? current.map(g => g.id === updated.id ? updated : g) : [updated, ...current]));
        socket.on('typing:update', (payload: {
            userId: number;
            typing: boolean;
        }) => {
            if (payload.userId === activeIdRef.current) {
                setTypingUser(payload.typing ? payload.userId : null);
                if (typingTimerRef.current)
                    clearTimeout(typingTimerRef.current);
                if (payload.typing)
                    typingTimerRef.current = setTimeout(() => setTypingUser(null), 2500);
            }
        });
        socket.on('unread:update', (payload: {
            fromUserId: number;
        }) => {
            if (activeIdRef.current === payload.fromUserId)
                return;
            setUnread(current => ({ ...current, [payload.fromUserId]: (current[payload.fromUserId] || 0) + 1 }));
        });
        socket.on('messages:read', (payload: {
            byUserId: number;
        }) => {
            if (payload.byUserId === activeIdRef.current)
                setMessages(current => current.map(m => m.senderId === session.user.id ? { ...m, readAt: m.readAt || new Date().toISOString() } : m));
        });
        socket.on('message:new', (message: Message) => {
            if (message.senderId === activeIdRef.current && message.recipientId === session.user.id)
                setUnread(current => ({ ...current, [message.senderId]: 0 }));
            setMessages(current => {
                if (activeIdRef.current === null || (message.senderId !== activeIdRef.current && message.recipientId !== activeIdRef.current))
                    return current;
                return current.some(m => m.id === message.id) ? current : [...current, message];
            });
        });
        socket.on('group:message:new', (message: GroupMessage) => {
            if (activeGroupIdRef.current === message.groupId)
                setGroupMessages(current => current.some(m => m.id === message.id) ? current : [...current, message]);
        });
        return () => { alive = false; socket.disconnect(); socketRef.current = null; };
    }, [session?.token, loadDirectory, signOut]);
    useEffect(() => {
        if (!session || !activeUser) {
            setMessages([]);
            setHasMoreMessages(false);
            return;
        }
        let alive = true;
        setMessages([]);
        setHasMoreMessages(false);
        setUnread(current => ({ ...current, [activeUser.id]: 0 }));
        request<{ messages: Message[]; hasMore: boolean }>(`/api/messages/${activeUser.id}?limit=50`, session.token).then(d => {
            if (alive) {
                setMessages(d.messages);
                setHasMoreMessages(d.hasMore);
            }
        }).catch(e => setPageError(e.message));
        return () => { alive = false; };
    }, [session?.token, activeUser?.id]);
    useEffect(() => {
        if (!session || !activeGroup) {
            setGroupMessages([]);
            setHasMoreGroupMessages(false);
            return;
        }
        let alive = true;
        setGroupMessages([]);
        setHasMoreGroupMessages(false);
        request<{ messages: GroupMessage[]; hasMore: boolean }>(`/api/groups/${activeGroup.id}/messages?limit=50`, session.token).then(d => {
            if (alive) {
                setGroupMessages(d.messages);
                setHasMoreGroupMessages(d.hasMore);
            }
        }).catch(e => setPageError(e.message));
        return () => { alive = false; };
    }, [session?.token, activeGroup?.id]);
    useLayoutEffect(() => {
        const restore = historyRestoreRef.current;
        const container = conversationBodyRef.current;
        if (!restore || !container) return;
        container.scrollTop = container.scrollHeight - restore.height + restore.top;
        historyRestoreRef.current = null;
    }, [messages, groupMessages]);
    useEffect(() => {
        if (!shouldAutoScrollRef.current) return;
        const container = conversationBodyRef.current;
        if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }, [messages, groupMessages, activeUser?.id, activeGroup?.id]);
    useEffect(() => {
        if (!session || !activeUser || messageSearch.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        let alive = true;
        const timer = setTimeout(() => request<{
            messages: Message[];
        }>(`/api/search?q=${encodeURIComponent(messageSearch.trim())}`, session.token).then(d => {
            if (alive)
                setSearchResults(d.messages);
        }).catch(e => setPageError(e.message)), 250);
        return () => { alive = false; clearTimeout(timer); };
    }, [messageSearch, session?.token, activeUser?.id]);
    async function submitAuth(e: FormEvent) {
        e.preventDefault();
        setBusy(true);
        setAuthError('');
        try {
            const result = await request<Session>(`/api/auth/${authMode}`, undefined, { method: 'POST', body: JSON.stringify({ username: username.trim(), password }) });
            localStorage.setItem('stychat-session', JSON.stringify(result));
            setSession(result);
            setPassword('');
            setPageError('');
        }
        catch (error) {
            setAuthError(error instanceof Error ? error.message : 'Не удалось войти.');
        }
        finally {
            setBusy(false);
        }
    }
    async function loadOlderMessages() {
        if (!session || loadingOlder) return;
        const container = conversationBodyRef.current;
        if (!container) return;
        if (activeUser && hasMoreMessages && messages.length) {
            setLoadingOlder(true);
            shouldAutoScrollRef.current = false;
            const firstId = messages[0].id;
            const restore = { height: container.scrollHeight, top: container.scrollTop };
            try {
                const data = await request<{ messages: Message[]; hasMore: boolean }>(`/api/messages/${activeUser.id}?limit=50&beforeId=${firstId}`, session.token);
                historyRestoreRef.current = restore;
                setMessages(current => [...data.messages, ...current.filter(existing => !data.messages.some(older => older.id === existing.id))]);
                setHasMoreMessages(data.hasMore);
            } catch (error) {
                setPageError(error instanceof Error ? error.message : 'Не удалось загрузить историю.');
            } finally {
                setLoadingOlder(false);
            }
        } else if (activeGroup && hasMoreGroupMessages && groupMessages.length) {
            setLoadingOlder(true);
            shouldAutoScrollRef.current = false;
            const firstId = groupMessages[0].id;
            const restore = { height: container.scrollHeight, top: container.scrollTop };
            try {
                const data = await request<{ messages: GroupMessage[]; hasMore: boolean }>(`/api/groups/${activeGroup.id}/messages?limit=50&beforeId=${firstId}`, session.token);
                historyRestoreRef.current = restore;
                setGroupMessages(current => [...data.messages, ...current.filter(existing => !data.messages.some(older => older.id === existing.id))]);
                setHasMoreGroupMessages(data.hasMore);
            } catch (error) {
                setPageError(error instanceof Error ? error.message : 'Не удалось загрузить историю группы.');
            } finally {
                setLoadingOlder(false);
            }
        }
    }
    function chooseUser(user: User) { shouldAutoScrollRef.current = true; historyRestoreRef.current = null; setActiveUser(user); setActiveGroup(null); setTab('chats'); setPageError(''); setMessageSearch(''); }
    function chooseGroup(group: Group) { shouldAutoScrollRef.current = true; historyRestoreRef.current = null; setActiveGroup(group); setActiveUser(null); setTab('groups'); setPageError(''); setMessageSearch(''); }
    function sendBody(body: string) {
        if (!body.trim() || !socketRef.current?.connected) return;
        const targetKey = activeConversationKey;
        if (activeGroup)
            socketRef.current.emit('group:message:send', { groupId: activeGroup.id, body }, (result: { ok: boolean; error?: string }) => {
                if (!result?.ok) { setPageError(result?.error || 'Не удалось отправить сообщение.'); setDraftFor(targetKey, body); }
            });
        else if (activeUser) {
            socketRef.current.emit('typing:stop', activeUser.id);
            socketRef.current.emit('message:send', { recipientId: activeUser.id, body }, (result: { ok: boolean; error?: string }) => {
                if (!result?.ok) { setPageError(result?.error || 'Не удалось отправить сообщение.'); setDraftFor(targetKey, body); }
            });
        }
    }
    function sendMessage(e: FormEvent) {
        e.preventDefault();
        if (!draft.trim() || !socketRef.current?.connected) return;
        const body = draft.trim();
        setDraft('');
        setPageError('');
        sendBody(body);
    }
    async function handleMediaSelected(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || !session || (!activeUser && !activeGroup)) return;
        const allowed = ['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm','audio/mpeg','audio/ogg','audio/wav','audio/webm','application/pdf'];
        if (!allowed.includes(file.type)) { setPageError('Поддерживаются изображения, видео, аудио и PDF.'); return; }
        if (file.size > 8 * 1024 * 1024) { setPageError('Максимальный размер файла: 8 МБ.'); return; }
        setUploadingMedia(true); setPageError('');
        try {
            const data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Не удалось прочитать файл.'));
                reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
                reader.readAsDataURL(file);
            });
            const uploaded = await request<{url:string; name:string; mimeType:string; size:number}>('/api/media', session.token, { method: 'POST', body: JSON.stringify({ name: file.name, mimeType: file.type, data }) });
            sendBody(`STYCHAT_MEDIA::${JSON.stringify(uploaded)}`);
        } catch (error) {
            setPageError(error instanceof Error ? error.message : 'Не удалось загрузить файл.');
        } finally { setUploadingMedia(false); }
    }
    function renderMessageBody(body: string) {
        if (!body.startsWith('STYCHAT_MEDIA::')) return body;
        try {
            const media = JSON.parse(body.slice('STYCHAT_MEDIA::'.length)) as {url:string;name:string;mimeType:string;size:number};
            const src = `${API}${media.url}`;
            if (media.mimeType.startsWith('image/')) return <a className="media-message" href={src} target="_blank" rel="noreferrer"><img src={src} alt={media.name}/><span>{media.name}</span></a>;
            if (media.mimeType.startsWith('video/')) return <div className="media-message"><video controls preload="metadata" src={src}/><span>{media.name}</span></div>;
            if (media.mimeType.startsWith('audio/')) return <div className="media-message"><audio controls preload="metadata" src={src}/><span>{media.name}</span></div>;
            return <a className="media-file-link" href={src} target="_blank" rel="noreferrer">📄 {media.name} · Открыть файл</a>;
        } catch { return 'Вложение'; }
    }
    function updateDraft(value: string) {
        setDraft(value);
        if (!activeUser || !socketRef.current?.connected)
            return;
        if (typingTimerRef.current)
            clearTimeout(typingTimerRef.current);
        if (value.trim()) {
            socketRef.current.emit('typing:start', activeUser.id);
            typingTimerRef.current = setTimeout(() => socketRef.current?.emit('typing:stop', activeUser.id), 1800);
        }
        else
            socketRef.current.emit('typing:stop', activeUser.id);
    }
    function openSettings(section: 'profile' | 'general' = 'general') { setSettingsSection(section); setProfileName(session?.user.displayName || session?.user.username || ''); setProfileStatus(session?.user.status || 'Доступен для общения'); setAvatarEmoji(session?.user.avatarEmoji || '🙂'); setSettingsOpen(true); }
    async function saveProfile(e: FormEvent) {
        e.preventDefault();
        if (!session)
            return;
        try {
            const result = await request<{
                user: User;
            }>('/api/profile', session.token, { method: 'PATCH', body: JSON.stringify({ displayName: profileName, status: profileStatus, avatarEmoji }) });
            setSession(current => {
                if (!current)
                    return current;
                const next = { ...current, user: result.user };
                localStorage.setItem('stychat-session', JSON.stringify(next));
                return next;
            });
            setPageError('');
        }
        catch (error) {
            setPageError(error instanceof Error ? error.message : 'Не удалось сохранить профиль.');
        }
    }
    async function createGroup(e: FormEvent) {
        e.preventDefault();
        if (!session)
            return;
        try {
            const result = await request<{
                group: Group;
            }>('/api/groups', session.token, { method: 'POST', body: JSON.stringify({ name: groupName, description: groupDescription, memberIds: selectedMembers }) });
            setGroups(current => [result.group, ...current.filter(g => g.id !== result.group.id)]);
            setCreateGroupOpen(false);
            setGroupName('');
            setGroupDescription('');
            setSelectedMembers([]);
            chooseGroup(result.group);
            setPageError('');
        }
        catch (error) {
            setPageError(error instanceof Error ? error.message : 'Не удалось создать группу.');
        }
    }
    const filteredUsers = useMemo(() => users.filter(u => `${u.username} ${u.displayName || ''} ${u.status || ''}`.toLowerCase().includes(search.toLowerCase()) && (tab !== 'chats' || filter !== 'unread' || (unread[u.id] || 0) > 0)), [users, search, tab, filter, unread]);
    const filteredGroups = useMemo(() => groups.filter(g => `${g.name} ${g.description}`.toLowerCase().includes(search.toLowerCase())), [groups, search]);
    const activeTitle = activeGroup?.name || activeUser?.displayName || activeUser?.username || '';
    const activeConversationKey = activeGroup ? `group:${activeGroup.id}` : activeUser ? `user:${activeUser.id}` : '';
    const draft = activeConversationKey ? drafts[activeConversationKey] || '' : '';
    function setDraft(value: string | ((current: string) => string)) {
        if (!activeConversationKey) return;
        setDrafts(current => {
            const previous = current[activeConversationKey] || '';
            const next = typeof value === 'function' ? value(previous) : value;
            return { ...current, [activeConversationKey]: next };
        });
    }
    function setDraftFor(key: string, value: string) {
        setDrafts(current => ({ ...current, [key]: value }));
    }
    const filteredGroupMessages = useMemo(() => {
        const query = messageSearch.trim().toLocaleLowerCase();
        if (query.length < 2) return groupMessages;
        return groupMessages.filter(message =>
            `${message.senderDisplayName || message.senderUsername} ${message.body}`.toLocaleLowerCase().includes(query)
        );
    }, [groupMessages, messageSearch]);
    if (!session) {
        return (<AuthScreen theme={theme} authMode={authMode} setAuthMode={(mode) => {
                setAuthMode(mode);
                setAuthError('');
            }} username={username} setUsername={setUsername} password={password} setPassword={setPassword} authError={authError} busy={busy} onSubmit={submitAuth}/>);
    }
    return <main className={`app-shell ${theme}`}>
    <aside className="rail"><div className="rail-logo"><MessageCircle size={22}/></div><button className={`rail-button ${tab === 'chats' ? 'active' : ''}`} title="Чаты" onClick={() => { setTab('chats'); setActiveGroup(null); }}><MessageCircle size={21}/><span>Чаты</span></button><button className={`rail-button ${tab === 'groups' ? 'active' : ''}`} title="Группы" onClick={() => { setTab('groups'); setActiveUser(null); }}><Users size={21}/><span>Группы</span></button><button className={`rail-button ${tab === 'contacts' ? 'active' : ''}`} title="Контакты" onClick={() => { setTab('contacts'); setActiveGroup(null); }}><UserRound size={21}/><span>Люди</span></button><div className="rail-spacer"/><button className="rail-button" title="Настройки" onClick={() => openSettings()}><Settings size={21}/><span>Настройки</span></button><button className="rail-user" title="Мой профиль" onClick={() => openSettings('profile')}><Avatar name={session.user.displayName || session.user.username} id={session.user.id} size="small" emoji={session.user.avatarEmoji}/><span className="presence-dot"/></button></aside>
    <aside className={`sidebar ${activeUser || activeGroup ? 'mobile-hide' : ''}`}>
      <header className="sidebar-header"><div><div className="eyebrow">StyChat</div><h1>{tab === 'chats' ? 'Сообщения' : tab === 'groups' ? 'Группы' : 'Контакты'}</h1></div><button className="round-button" title={tab === 'groups' ? 'Создать группу' : 'Настройки'} onClick={() => tab === 'groups' ? setCreateGroupOpen(true) : tab === 'contacts' ? setProfileOpen(session.user) : openSettings()}>{tab === 'groups' ? <Plus size={19}/> : tab === 'contacts' ? <UserRoundPlus size={19}/> : <Settings size={18}/>}</button></header>
      <div className="self-card" onClick={() => openSettings('profile')} role="button" tabIndex={0}><Avatar name={session.user.displayName || session.user.username} id={session.user.id} online emoji={session.user.avatarEmoji}/><div className="self-info"><strong>{session.user.displayName || session.user.username}</strong><span><i className="status-dot"/> {session.user.status || 'Доступен для общения'}</span></div><ChevronDown size={16} className="muted-icon"/></div>
      <div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={tab === 'groups' ? 'Найти группу…' : tab === 'contacts' ? 'Найти контакт…' : 'Поиск по чатам…'}/>{search && <button onClick={() => setSearch('')} aria-label="Очистить"><X size={14}/></button>}</div>
      {tab === 'chats' && <div className="filter-row"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>Все <span>{users.length}</span></button><button className={filter === 'unread' ? 'selected' : ''} onClick={() => setFilter('unread')}>Непрочитанные <span>{Object.values(unread).reduce<number>((a, b) => a + Number(b), 0)}</span></button></div>}
      <div className="list-label">{tab === 'chats' ? 'ПОСЛЕДНИЕ ДИАЛОГИ' : tab === 'groups' ? 'ВАШИ ГРУППЫ' : 'СООБЩЕСТВО STYCHAT'}<span>{tab === 'groups' ? filteredGroups.length : filteredUsers.length}</span></div>
      <div className="contact-list">
        {tab === 'groups' ? <>{filteredGroups.length ? filteredGroups.map(group => <button key={group.id} className={`list-row ${activeGroup?.id === group.id ? 'selected' : ''}`} onClick={() => chooseGroup(group)}><Avatar name={group.name} id={group.id} group/><div className="row-copy"><strong>{group.name}</strong><span>{group.description || `${group.memberCount} участника`}</span></div><span className="row-chevron">›</span></button>) : <div className="empty-list"><div className="empty-illustration"><Users size={24}/></div><strong>Здесь появятся группы</strong><p>Создай группу для друзей, семьи или команды.</p><button className="small-primary" onClick={() => setCreateGroupOpen(true)}><Plus size={15}/> Создать группу</button></div>}</> : filteredUsers.length ? filteredUsers.map(user => <button key={user.id} className={`list-row ${activeUser?.id === user.id ? 'selected' : ''}`} onClick={() => tab === 'contacts' ? setProfileOpen(user) : chooseUser(user)}><Avatar name={user.displayName || user.username} id={user.id} online emoji={user.avatarEmoji}/><div className="row-copy"><strong>{user.displayName || user.username}</strong><span>{user.status || `@${user.username}`}</span></div>{tab === 'chats' && (unread[user.id] || 0) > 0 && <span className="unread-badge">{unread[user.id] > 99 ? '99+' : unread[user.id]}</span>}<span className="row-chevron">›</span></button>) : <div className="empty-list"><div className="empty-illustration"><UserRound size={24}/></div><strong>{users.length ? 'Ничего не найдено' : 'Пока никого нет'}</strong><p>{users.length ? 'Попробуй изменить запрос.' : 'Когда другие пользователи зарегистрируются, они появятся здесь.'}</p></div>}
      </div>
      <footer className="sidebar-footer"><div className="secure-mark"><ShieldCheck size={16}/></div><div><strong>Твоя связь под контролем</strong><span>{socketReady ? 'Подключено к серверу' : 'Ожидание соединения'}</span></div><i className={socketReady ? 'status-dot' : 'status-dot offline'}/></footer>
    </aside>
    <section className={`conversation ${!activeUser && !activeGroup ? 'mobile-hide' : ''}`}>
      {activeUser || activeGroup ? <><header className="conversation-header"><button className="back-mobile" onClick={() => { setActiveUser(null); setActiveGroup(null); }}><ArrowLeft size={20}/></button><button className="person-summary" onClick={() => activeUser ? setProfileOpen(activeUser) : setGroupInfoOpen(true)}>{activeGroup ? <Avatar name={activeGroup.name} id={activeGroup.id} group/> : <Avatar name={activeUser!.displayName || activeUser!.username} id={activeUser!.id} online/>}<span><strong>{activeTitle}</strong><small>{activeGroup ? `${activeGroup.memberCount} участника${activeGroup.memberCount === 1 ? '' : 'ов'} · ${activeGroup.description || 'Групповой чат'}` : typingUser === activeUser?.id ? 'печатает…' : activeUser?.status || (socketReady ? 'В сети' : 'Подключение…')}</small></span></button><div className="conversation-actions"><span className={`connection-pill ${socketReady ? 'connected' : ''}`}><i /> {socketReady ? 'В сети' : 'Оффлайн'}</span><button className="round-button subtle" title="Информация о чате" onClick={() => activeUser ? setProfileOpen(activeUser) : setGroupInfoOpen(true)}><Info size={18}/></button><button className="round-button subtle" title="Настройки" onClick={() => openSettings()}><MoreHorizontal size={20}/></button></div></header>
        <div className="conversation-body" ref={conversationBodyRef} onScroll={(event) => {
            const element = event.currentTarget;
            shouldAutoScrollRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 90;
        }}><div className="history-divider"><span />{activeGroup ? 'ГРУППОВАЯ ПЕРЕПИСКА' : 'ЛИЧНАЯ ПЕРЕПИСКА'}<span /></div>
          {((activeUser && hasMoreMessages) || (activeGroup && hasMoreGroupMessages)) && <button className="load-older-button" type="button" disabled={loadingOlder} onClick={loadOlderMessages}>{loadingOlder ? 'Загружаем историю…' : '↑ Загрузить предыдущие сообщения'}</button>}
          {activeUser && messageSearch.trim().length >= 2 && <div className="message-search-results"><strong>Результаты поиска · {searchResults.length}</strong>{searchResults.map(result => <button key={result.id} onClick={() => {
                        const peer = users.find(user => user.id === result.otherUserId);
                        if (peer)
                            chooseUser(peer);
                        setMessageSearch('');
                    }}><span>{result.senderUsername}</span>{result.body}</button>)}</div>}
          {activeUser && messages.length === 0 && <div className="empty-conversation"><div className="empty-conversation-icon"><MessageCircle size={25}/></div><strong>Начните разговор</strong><p>Напиши {activeTitle} первое сообщение. Здесь появится ваша история.</p></div>}
          {activeGroup && groupMessages.length === 0 && <div className="empty-conversation"><div className="empty-conversation-icon"><Users size={25}/></div><strong>Ваша группа создана!</strong><p>Поздоровайся со всеми и начните общаться вместе.</p></div>}
          {activeGroup && messageSearch.trim().length >= 2 && groupMessages.length > 0 && filteredGroupMessages.length === 0 && <div className="search-empty-state">В этой группе ничего не найдено по запросу «{messageSearch.trim()}».</div>}
          {activeUser && messages.map(message => { const mine = message.senderId === session.user.id; return <div key={message.id} className={`message-row ${mine ? 'mine' : ''}`}><Avatar name={mine ? session.user.displayName || session.user.username : activeUser.displayName || activeUser.username} id={mine ? session.user.id : activeUser.id} size="small" emoji={mine ? session.user.avatarEmoji : activeUser.avatarEmoji}/><div className="message-stack"><div className="message-author">{mine ? 'Вы' : message.senderUsername}<span>{timeLabel(message.createdAt)}</span></div><div className="message-bubble">{renderMessageBody(message.body)}</div>{mine && <div className="message-status">{message.readAt ? <><CheckCheck size={13}/> Прочитано</> : <><Check size={13}/> Отправлено</>}</div>}</div></div>; })}
          {activeGroup && filteredGroupMessages.map(message => { const mine = message.senderId === session.user.id; return <div key={message.id} className={`message-row ${mine ? 'mine' : ''}`}><Avatar name={message.senderDisplayName || message.senderUsername} id={message.senderId} size="small" emoji={message.senderId === session.user.id ? session.user.avatarEmoji : users.find(u => u.id === message.senderId)?.avatarEmoji}/><div className="message-stack"><div className="message-author">{mine ? 'Вы' : message.senderDisplayName || message.senderUsername}<span>{timeLabel(message.createdAt)}</span></div><div className="message-bubble">{renderMessageBody(message.body)}</div></div></div>; })}
          <div ref={bottomRef}/>
        </div>
        {pageError && <div className="inline-error"><span>{pageError}</span><button onClick={() => setPageError('')}><X size={14}/></button></div>}
        {(activeUser || activeGroup) && <div className="message-tools"><div className="message-search-input"><Search size={15}/><input value={messageSearch} onChange={e => setMessageSearch(e.target.value)} placeholder={activeGroup ? 'Найти сообщение в группе' : 'Найти в переписке'}/><button type="button" onClick={() => setMessageSearch('')} title="Очистить поиск"><X size={13}/></button></div><span>{activeGroup ? `${filteredGroupMessages.length} из ${groupMessages.length} сообщений` : 'Личные сообщения доступны только участникам диалога.'}</span></div>}
        <form className="composer" onSubmit={sendMessage}><input ref={mediaInputRef} type="file" hidden accept="image/*,video/mp4,video/webm,audio/*,application/pdf" onChange={handleMediaSelected}/><div className="composer-top">{emojiOpen && <div className="emoji-tray">{['😀', '😂', '🥹', '😍', '👍', '❤️', '🔥', '🎉', '👋', '✨', '🤝', '💚', '😎', '🙌', '🥳', '💬'].map(emoji => <button key={emoji} type="button" onClick={() => { setDraft(current => current + emoji); setEmojiOpen(false); }}>{emoji}</button>)}</div>}<textarea value={draft} onChange={e => updateDraft(e.target.value)} onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
                }
            }} placeholder={activeGroup ? `Написать в «${activeGroup.name}»…` : `Сообщение для ${activeTitle}…`} maxLength={2000} rows={1}/></div><div className="composer-bottom"><div className="composer-attachments"><button type="button" title="Прикрепить фото, видео, аудио или PDF" disabled={uploadingMedia} onClick={() => mediaInputRef.current?.click()}><ImagePlus size={18}/></button><button type="button" title="Эмодзи" className={emojiOpen ? 'pressed' : ''} onClick={() => setEmojiOpen(value => !value)}><Smile size={18}/></button><span>{uploadingMedia ? 'Загружаем файл…' : 'Фото, видео, аудио, PDF · до 8 МБ'}</span></div><button className="send-button" disabled={!draft.trim() || !socketReady} aria-label="Отправить"><Send size={17}/><span>Отправить</span></button></div></form>
      </> : <div className="welcome-screen"><div className="welcome-banner"><div className="welcome-bubble bubble-one"><MessageCircle size={18}/></div><div className="welcome-bubble bubble-two"><Users size={19}/></div><div className="welcome-bubble bubble-three"><Smile size={17}/></div><div className="welcome-logo"><MessageCircle size={38}/></div></div><div className="welcome-kicker">ТВОЙ КРУГ ОБЩЕНИЯ</div><h2>Хорошие разговоры<br /><span>начинаются здесь.</span></h2><p>Выбери контакт, продолжи личный разговор<br />или создай группу для всех своих людей.</p><div className="welcome-actions"><button className="primary-button" onClick={() => { setTab('contacts'); }}><UserRoundPlus size={17}/> Найти людей</button><button className="secondary-button" onClick={() => { setTab('groups'); setCreateGroupOpen(true); }}><Users size={17}/> Создать группу</button></div><div className="welcome-foot"><span className={socketReady ? 'status-dot' : 'status-dot offline'}/>{socketReady ? 'Сервер подключён' : 'Подключаемся к серверу'}<span>·</span> Stychat от Win Stydio</div></div>}
    </section>
    {settingsOpen && (<SettingsModal theme={theme} setTheme={setTheme} session={session} profileName={profileName} setProfileName={setProfileName} profileStatus={profileStatus} setProfileStatus={setProfileStatus} avatarEmoji={avatarEmoji} setAvatarEmoji={setAvatarEmoji} initialSection={settingsSection} onSaveProfile={saveProfile} onClose={() => setSettingsOpen(false)} onSignOut={signOut}/>)}
    {profileOpen && (<ProfileModal user={profileOpen} currentUserId={session.user.id} onClose={() => setProfileOpen(null)} onMessage={(user) => {
                chooseUser(user);
                setProfileOpen(null);
            }} onSettings={() => {
                setProfileOpen(null);
                openSettings('profile');
            }}/>)}
    {groupInfoOpen && activeGroup && (<GroupDetailsModal group={activeGroup} token={session.token} onClose={() => setGroupInfoOpen(false)} onOpenProfile={(user) => {
                setGroupInfoOpen(false);
                setProfileOpen(user);
            }}/>)}
    {createGroupOpen && (<CreateGroupModal users={users} groupCount={groups.length} groupName={groupName} setGroupName={setGroupName} groupDescription={groupDescription} setGroupDescription={setGroupDescription} selectedMembers={selectedMembers} setSelectedMembers={setSelectedMembers} onSubmit={createGroup} onClose={() => setCreateGroupOpen(false)}/>)}
  </main>;
}
