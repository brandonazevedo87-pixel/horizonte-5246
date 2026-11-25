import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { authClient, clearToken } from '../lib/auth';
import Dashboard from './dashboard';

const fragment = new URLSearchParams(window.location.hash.slice(1));
const code = fragment.get('convite');
const invite = code && /^[a-f0-9]{64}$/.test(code) ? code : null;
if (fragment.has('convite')) window.history.replaceState(null, '', window.location.pathname);

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const time = new Intl.DateTimeFormat('pt-BR', {hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).format(now);
  const date = new Intl.DateTimeFormat('pt-BR', {weekday:'long', day:'numeric', month:'long'}).format(now);
  return <section className="clock" aria-label="Horário local"><span className="clock-tag"><i/> HORÁRIO LOCAL</span><time className="clock-time" dateTime={time}>{time}</time><p>{date.charAt(0).toUpperCase()+date.slice(1)}</p></section>;
}

export default function Index() {
  const session = authClient.useSession();
  const [setup, setSetup] = useState(Boolean(invite));
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    const text = (key: string) => String(fields.get(key) ?? '');
    setPending(true); setError('');
    try {
      clearToken();
      const credentials = { email: text('email').trim().toLowerCase(), password: text('password') };
      const result = setup && invite
        ? await authClient.signUp.email({ ...credentials, name: text('name').trim() }, { headers: { 'x-owner-invite': invite } })
        : await authClient.signIn.email(credentials);
      if (result.error) {
        setError(result.error.status === 429 ? 'Muitas tentativas. Aguarde um minuto e tente novamente.' : setup
          ? result.error.status === 403 ? result.error.message || 'Convite inválido.' : 'Não foi possível criar seu acesso. Confira os dados e tente novamente.'
          : result.error.status === 401 || result.error.status === 400 ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar. Tente novamente.');
      } else {
        setSetup(false);
        await session.refetch();
      }
    } catch { setError('Não foi possível conectar. Tente novamente.'); }
    finally { setPending(false); }
  }

  if (session.data?.user) return <Dashboard name={session.data.user.name} email={session.data.user.email}/>;

  return <main className="lock-screen">
    <div className="wallpaper" aria-hidden="true"/>
    <div className="lock-spacer" aria-hidden="true"/>
    <div className="lock-body">
      <Clock/>
      <section className="access-card" aria-labelledby="access-title">
        <h1 id="access-title">{setup ? 'Crie seu acesso' : 'Entrar no painel'}</h1>
        <form onSubmit={submit} className="access-form" key={String(setup)}>
          {setup && <label>Seu nome<span className="glass-input"><input aria-label="Seu nome" name="name" placeholder="Seu nome" required maxLength={100} autoComplete="name"/></span></label>}
          <label>E-mail<span className="glass-input"><input aria-label="E-mail" name="email" type="email" placeholder="seu@email.com" required maxLength={254} autoComplete="username" /></span></label>
          <label>Senha<span className="glass-input password-field"><input aria-label="Senha" name="password" type={visible ? 'text' : 'password'} placeholder={setup ? 'Pelo menos 10 caracteres' : 'Digite sua senha'} minLength={setup ? 10 : undefined} maxLength={128} autoComplete={setup ? 'new-password' : 'current-password'} required/><button className="eye" type="button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></span></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="gold-button" type="submit" disabled={pending || session.isPending}>{pending || session.isPending ? <><LoaderCircle size={17} className="spin"/> Aguarde…</> : <>{setup ? 'Criar meu acesso' : 'Entrar'}<ArrowRight size={19}/></>}</button>
        </form>
        {setup && <a className="back-to-login" href="/"><ArrowLeft size={15}/> Voltar para o login</a>}
      </section>
    </div>
    <footer className="lock-bottom"><a href="https://commons.wikimedia.org/wiki/File:Macau_Skyline_(157820121).jpeg" target="_blank" rel="noreferrer" title="Macau Skyline, Mike — CC BY 3.0">Macau · Foto de Mike</a></footer>
  </main>;
}
