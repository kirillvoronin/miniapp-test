import React, { useEffect, useMemo, useState } from 'react';
import { initData, miniApp, themeParams, hapticFeedback } from '@telegram-apps/sdk';
import { useSignal, useRawInitData } from '@telegram-apps/sdk-react';

export default function App() { return <DemoApp />; }

function DemoApp() {
  const ma = miniApp;
  const theme = themeParams;
  const haptic = hapticFeedback;
  const init = initData;

  const [access, setAccess] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>('');

  const raw = useRawInitData();
  const initUser = useSignal(init.user);
  const initStartParam = useSignal(init.startParam);
  const initChatType = useSignal(init.chatType);
  const initChatInstance = useSignal(init.chatInstance);
  const initQueryId = useSignal(init.queryId);
  const initAuthDate = useSignal(init.authDate);

  const isDark = !!useSignal(theme.isDark);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    ma?.ready();
  }, [ma]);

  const API_BASE = (import.meta as any)?.env?.VITE_API_BASE ?? '';
  const AUTH_ENDPOINT = (import.meta as any)?.env?.VITE_AUTH_ENDPOINT ?? '/auth/telegram';
  const PROJECT_ID = (import.meta as any)?.env?.VITE_DEMO_PROJECT_ID ?? 'demo';

  async function login() {
    if (!raw) {
      setLog('initData не найден. Откройте приложение внутри Telegram.');
      return;
    }
    try {
      setBusy(true);
      setLog('Авторизация…');
      const res = await fetch(`${API_BASE}${AUTH_ENDPOINT}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ initData: raw }),
      });
      const j = await res.json();
      if (!res.ok || !j?.access) throw new Error(j?.error || 'Auth failed');
      setAccess(j.access);
      setUser(j.user || initUser);
      setLog('OK');
      haptic?.impactOccurred('medium');
    } catch (e: any) {
      setLog(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function callProtected() {
    try {
      setBusy(true);
      let res = await fetch(`${API_BASE}/projects/${PROJECT_ID}`, {
        method: 'GET',
        headers: withAuth({}, access),
        credentials: 'include',
      });
      if (res.status === 401) {
        const rr = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
        if (rr.ok) {
          const { access: a } = await rr.json();
          if (a) {
            setAccess(a);
            res = await fetch(`${API_BASE}/projects/${PROJECT_ID}`, {
              method: 'GET',
              headers: withAuth({}, a),
              credentials: 'include',
            });
          }
        }
      }
      const j = await res.json();
      setLog(JSON.stringify(j, null, 2));
      haptic?.notificationOccurred('success');
    } catch (e: any) {
      setLog(e.message || String(e));
      haptic?.notificationOccurred('error');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      setBusy(true);
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: withAuth({}, access),
      });
      setAccess(null);
      setLog('Вышли');
    } finally {
      setBusy(false);
    }
  }

  const prettyUser = useMemo(() => user || initUser, [user, initUser]);

  return (
    <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 p-4">
      <div className="max-w-xl mx-auto grid gap-4">
        <Header />

        <Card>
          <div className="flex items-center gap-3">
            <Avatar name={prettyUser?.firstName || 'Anon'} photoUrl={prettyUser?.photoUrl} />
            <div className="flex-1">
              <div className="text-lg font-semibold">
                {prettyUser ? prettyUser.firstName + (prettyUser.lastName ? ` ${prettyUser.lastName}` : '') : 'Гость'}
              </div>
              <div className="text-sm opacity-70">{prettyUser?.username ? '@' + prettyUser.username : '—'}</div>
            </div>
            <span className="px-2 py-1 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
              {access ? 'authorized' : 'no token'}
            </span>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-medium opacity-70 mb-2">Контекст Mini App</h3>
          <dl className="text-sm grid grid-cols-2 gap-y-1">
            <DT>start_param</DT>
            <DD>{initStartParam ?? '—'}</DD>
            <DT>chat_type</DT>
            <DD>{initChatType ?? '—'}</DD>
            <DT className="">chat_instance</DT>
            <DD className="break-all">{initChatInstance ?? '—'}</DD>
            <DT>query_id</DT>
            <DD className="break-all">{initQueryId ?? '—'}</DD>
            <DT>auth_date</DT>
            <DD>{initAuthDate?.toLocaleString?.() ?? '—'}</DD>
          </dl>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs opacity-70">raw initData</summary>
            <pre className="mt-2 text-xs whitespace-pre-wrap break-all p-2 rounded bg-black/5 dark:bg-white/10">{raw ?? 'undefined (запустите внутри Telegram)'}</pre>
          </details>
        </Card>

        <Card>
          <h3 className="text-sm font-medium opacity-70 mb-2">Действия</h3>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={login} disabled={busy || !raw}>{access ? 'Пере-логин' : 'Войти'}</Btn>
            <Btn onClick={callProtected} disabled={busy || !access}>Запрос к /projects/demo</Btn>
            <Btn onClick={logout} variant="secondary" disabled={busy && !access}>Выйти</Btn>
          </div>
          <div className="mt-3">
            <h4 className="text-sm font-medium opacity-70">Логи</h4>
            <pre className="mt-1 text-xs whitespace-pre-wrap break-all p-2 rounded bg-black/5 dark:bg-white/10 min-h-[64px]">{log || '—'}</pre>
          </div>
        </Card>

        <Footer />
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm0 2a8 8 0 1 1 0 16A8 8 0 0 1 12 4Zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 7c-2.21 0-4.2 1.79-4.2 4h8.4c0-2.21-1.99-4-4.2-4Z" />
      </svg>
      <h1 className="text-xl font-semibold">TMA Demo · JWT + refresh</h1>
    </div>
  );
}

function Footer() {
  return <div className="text-center text-xs opacity-60 py-2">React · @telegram-apps/sdk@3 · Tailwind-friendly styles</div>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl p-4 bg-white dark:bg-neutral-800 shadow-sm border border-black/5 dark:border-white/10">{children}</div>;
}

function Avatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const initials = (name || '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
      {photoUrl ? (
        <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-sm font-semibold">{initials}</span>
      )}
    </div>
  );
}

function DT({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dt className={`opacity-70 ${className ?? ''}`}>{children}</dt>;
}
function DD({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dd className={`font-mono ${className ?? ''}`}>{children}</dd>;
}

function Btn({
  children,
  onClick,
  disabled,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const cls =
    variant === 'primary'
      ? 'bg-blue-600 hover:bg-blue-700 text-white'
      : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-900 dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:text-neutral-50';
  return (
    <button onClick={onClick} disabled={disabled} className={`px-4 py-2 rounded-xl text-sm font-medium shadow-sm disabled:opacity-50 ${cls}`}>
      {children}
    </button>
  );
}

function withAuth(h: Record<string, string>, access: string | null) {
  return access ? { ...h, Authorization: `Bearer ${access}` } : h;
}


