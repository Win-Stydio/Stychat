export function initials(name: string) { return (name.trim().split(/[\s._-]+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2) || '?').toUpperCase(); }
export function timeLabel(date: string) { const d = new Date(date); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
export function dateLabel(date: string) { const d = new Date(date); if (Number.isNaN(d.getTime()))
    return ''; const today = new Date(); return d.toDateString() === today.toDateString() ? 'Сегодня' : d.toLocaleDateString([], { day: 'numeric', month: 'long' }); }

export function participantLabel(count: number) {
  const value = Math.abs(Math.trunc(count));
  const lastTwo = value % 100;
  const last = value % 10;
  const word = lastTwo >= 11 && lastTwo <= 14
    ? 'участников'
    : last === 1
      ? 'участник'
      : last >= 2 && last <= 4
        ? 'участника'
        : 'участников';
  return `${count} ${word}`;
}
