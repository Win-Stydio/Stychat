import { CheckCircle2, LogOut, Moon, ShieldCheck, Sun, X } from 'lucide-react';

type SettingsModalProps = {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  onClose: () => void;
  onSignOut: () => void;
};

export function SettingsModal({ theme, setTheme, onClose, onSignOut }: SettingsModalProps) {
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

        <div className="settings-section">
          <h3>Внешний вид</h3>
          <p>Выбери оформление, которое тебе комфортно.</p>
          <div className="theme-options">
            <button type="button" className={theme === 'light' ? 'theme-choice chosen' : 'theme-choice'} onClick={() => setTheme('light')}>
              <div className="theme-preview light-preview"><span /><span /><i /></div>
              <span><Sun size={16} /> Светлая</span>
              {theme === 'light' && <CheckCircle2 size={17} />}
            </button>
            <button type="button" className={theme === 'dark' ? 'theme-choice chosen' : 'theme-choice'} onClick={() => setTheme('dark')}>
              <div className="theme-preview dark-preview"><span /><span /><i /></div>
              <span><Moon size={16} /> Тёмная</span>
              {theme === 'dark' && <CheckCircle2 size={17} />}
            </button>
          </div>
        </div>

        <div className="settings-section settings-bottom">
          <div className="settings-about">
            <ShieldCheck size={19} />
            <div>
              <strong>Stychat от Win Stydio</strong>
              <span>Ваши разговоры, ваш круг</span>
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
