import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowRight, Box, CalendarDays, Check, CircleAlert, Clock3, CreditCard, LayoutDashboard, LoaderCircle, LogOut, Pencil, Plus, ReceiptText, Search, UsersRound, X } from 'lucide-react';
import { authClient, clearToken } from '../lib/auth';
import { useLedger, useLedgerActions } from '../queries/ledger';
import { Logo } from '../components/logo';

type Data = NonNullable<ReturnType<typeof useLedger>['data']>;
type Client = Data['clients'][number];
type Service = Data['services'][number];
type Charge = Data['charges'][number];
type Editor = {kind:'client'; row?:Client} | {kind:'service'; row?:Service} | {kind:'charge'; row?:Charge} | {kind:'payment'; row:Charge};
type Tab = 'Visão geral' | 'Clientes' | 'Serviços' | 'Mensalidades';
const pages = [{name:'Visão geral', icon:LayoutDashboard}, {name:'Clientes', icon:UsersRound}, {name:'Serviços', icon:Box}, {name:'Mensalidades', icon:ReceiptText}] as const;
const empty: Data = {clients:[], services:[], charges:[]};
const brl = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const cash = (value: number) => brl.format(value / 100);
const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format();
const toDate = (date: string) => date.split('-').reverse().join('/');
const monthLabel = (month:string) => new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${month}-01T12:00:00Z`));
const statusOf = (row: Charge) => row.paidAt ? 'Pago' : row.due < today() ? 'Atrasado' : 'Pendente';
const stateClass = {Pago:'paid', Atrasado:'late', Pendente:'due'};
const sum = (rows: Charge[]) => rows.reduce((n, row) => n + row.amount, 0);
const norm = (value:string) => value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const subtitle: Record<Tab,string> = {
  'Visão geral':'Acompanhe seus clientes e o recebimento das mensalidades.',
  Clientes:'Gerencie os contatos de quem contrata seus serviços.',
  Serviços:'Cadastre o que você oferece e defina os valores de referência.',
  Mensalidades:'Organize vencimentos e registre os pagamentos recebidos.',
};

function Empty({icon, title, description, action}: {icon:ReactNode; title:string; description:string; action?:ReactNode}) {
  return <div className="empty-state"><span>{icon}</span><strong>{title}</strong><p>{description}</p>{action}</div>;
}

export default function Dashboard({name,email}: {name:string; email:string}) {
  const ledger = useLedger();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('Visão geral');
  const [period, setPeriod] = useState(today().slice(0,7));
  const [search,setSearch] = useState('');
  const [status,setStatus] = useState('');
  const [editor,setEditor] = useState<Editor | null>(null);
  const [notice,setNotice] = useState('');
  const [exitError,setExitError] = useState('');
  const [exiting,setExiting] = useState(false);
  const data = ledger.data ?? empty;
  const {clients,services,charges} = data;
  const names = new Map(clients.map(c => [c.id,c.name]));
  const offerings = new Map(services.map(s => [s.id,s.name]));
  const visibleMonth = charges.filter(c => !period || c.period === period);
  const filteredCharges = visibleMonth.filter(c => (!status || statusOf(c) === status) && norm(`${names.get(c.clientId) ?? ''} ${offerings.get(c.serviceId) ?? ''}`).includes(norm(search.trim())));
  const open = visibleMonth.filter(row => !row.paidAt);
  const ready = Boolean(clients.length && services.length);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  },[notice]);

  function go(next: Tab) { setTab(next); setSearch(''); setStatus(''); }
  function create() {
    if (tab === 'Clientes' || !clients.length) setEditor({kind:'client'});
    else if (tab === 'Serviços' || !services.length) setEditor({kind:'service'});
    else setEditor({kind:'charge'});
  }
  function newRecordLabel() {
    if (tab === 'Clientes' || (tab !== 'Serviços' && !clients.length)) return 'Novo cliente';
    if (tab === 'Serviços' || !services.length) return 'Novo serviço';
    return 'Nova mensalidade';
  }
  async function logout() {
    setExiting(true); setExitError('');
    try {
      const result = await authClient.signOut();
      if (result.error) throw Error(result.error.message);
      clearToken(); queryClient.clear();
    } catch { setExitError('Não foi possível sair. Tente novamente.'); }
    finally { setExiting(false); }
  }
  const newRecord = <button className="primary" onClick={() => tab === 'Serviços' ? setEditor({kind:'service'}) : create()}><Plus size={18}/>{newRecordLabel()}</button>;

  function chargeTable(rows: Charge[]) {
    return <div className="table-scroll"><table><thead><tr><th>Cliente / Serviço</th><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>
      {rows.map(record => {
        const state = statusOf(record);
        return <tr key={record.id}><td><strong>{names.get(record.clientId)}</strong><small>{offerings.get(record.serviceId)}</small></td><td className="capitalize">{monthLabel(record.period)}</td><td>{toDate(record.due)}</td><td><strong>{cash(record.amount)}</strong></td><td><span className={`pill ${stateClass[state]}`}>{state}</span>{record.paidAt && <small>{toDate(record.paidAt)}</small>}</td><td><div className="table-actions"><button className="action-icon" title="Editar mensalidade" aria-label="Editar mensalidade" onClick={() => setEditor({kind:'charge',row:record})}><Pencil size={16}/></button><button className="text-button" onClick={() => setEditor({kind:'payment',row:record})}>{record.paidAt ? 'Estornar baixa' : 'Dar baixa'}</button></div></td></tr>;
      })}
    </tbody></table></div>;
  }

  const filterMonth = <label className="month-picker"><CalendarDays size={17}/><input type="month" aria-label="Competência" value={period} onChange={e => setPeriod(e.target.value)}/></label>;
  return <div className="panel-layout">
    <aside className="sidebar"><Logo/><div className="sidebar-nav"><div className="sidebar-kicker">GESTÃO</div><nav aria-label="Menu do painel">{pages.map(({name:page,icon:Icon}) => <button key={page} aria-current={tab===page?'page':undefined} onClick={() => go(page)}><Icon size={18}/><span>{page}</span></button>)}</nav></div><div className="sidebar-bottom"><div className="account"><span className="avatar">{name.trim().slice(0,1).toUpperCase()}</span><span><strong>{name}</strong><small>{email}</small></span></div><button className="logout" onClick={logout} disabled={exiting}>{exiting ? <LoaderCircle className="spin" size={17}/> : <LogOut size={17}/>} Sair</button>{exitError && <p className="exit-error" role="alert">{exitError}</p>}</div></aside>
    <main className="panel-main"><header className="panel-header"><div><span className="page-kicker"><i/> PAINEL ADMINISTRATIVO</span><h1>{tab}</h1><p>{subtitle[tab]}</p></div>{!ledger.isPending && !ledger.isError && newRecord}</header>
      {ledger.isPending ? <div className="surface"><Empty icon={<LoaderCircle className="spin"/>} title="Carregando seu painel…" description=""/></div> : ledger.isError ? <div className="surface"><Empty icon={<CircleAlert/>} title="Não foi possível carregar os dados" description="Verifique sua conexão e tente novamente." action={<button className="secondary" onClick={() => ledger.refetch()}>Tentar novamente</button>}/></div> : <>
        {tab === 'Visão geral' && <>
          <div className="overview-bar"><h2>Resumo financeiro</h2>{filterMonth}</div>
          <div className="metrics">
            {[{title:'Clientes', value:clients.length, icon:UsersRound, theme:'navy'}, {title:'Recebido', value:cash(sum(visibleMonth.filter(c=>c.paidAt))), icon:ArrowDownLeft, theme:'green'}, {title:'A receber', value:cash(sum(open)), icon:Clock3, theme:'gold'}, {title:'Em atraso', value:cash(sum(open.filter(c=>statusOf(c)==='Atrasado'))), icon:CircleAlert, theme:'red'}].map(({title,value,icon:Icon,theme}) => <section key={title} className="metric"><span className={`metric-icon ${theme}`}><Icon size={19}/></span><span>{title}</span><strong>{value}</strong></section>)}
          </div>
          <section className="surface"><header className="surface-head"><div><h2>Mensalidades da competência</h2><p>Vencimentos e pagamentos registrados.</p></div><button className="text-button" onClick={() => go('Mensalidades')}>Ver mensalidades <ArrowRight size={15}/></button></header>{visibleMonth.length ? chargeTable(visibleMonth.slice(0,6)) : <Empty icon={<ReceiptText/>} title="Nenhuma mensalidade neste período" description={ready ? 'Cadastre uma mensalidade para começar a acompanhar seus recebimentos.' : 'Cadastre um cliente e um serviço para lançar sua primeira mensalidade.'} action={newRecord}/>}</section>
        </>}
        {tab !== 'Visão geral' && <section className="surface">
          <div className="filters"><label className="search"><Search size={18}/><input aria-label="Buscar registros" placeholder={tab === 'Clientes' ? 'Buscar cliente…' : tab === 'Serviços' ? 'Buscar serviço…' : 'Buscar cliente ou serviço…'} value={search} onChange={e => setSearch(e.target.value)}/></label>{tab === 'Mensalidades' && <>{filterMonth}<select className="status-filter" aria-label="Filtrar por status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos os status</option><option>Pago</option><option>Pendente</option><option>Atrasado</option></select><button className="text-button" onClick={() => {setPeriod('');setStatus('');setSearch('');}}>Todo o histórico</button></>}</div>
          {tab === 'Clientes' && (() => { const rows = clients.filter(c => norm(`${c.name} ${c.email ?? ''} ${c.phone ?? ''}`).includes(norm(search.trim()))); return rows.length ? <div className="table-scroll"><table><thead><tr><th>Cliente</th><th>E-mail</th><th>Telefone</th><th>Ações</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.email || '—'}</td><td>{row.phone || '—'}</td><td><button className="text-button" onClick={() => setEditor({kind:'client',row})}><Pencil size={15}/>Editar</button></td></tr>)}</tbody></table></div> : <Empty icon={<UsersRound/>} title={search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'} description={search ? 'Tente outro nome, e-mail ou telefone.' : 'Adicione seu primeiro cliente para começar.'} action={!search && newRecord}/>; })()}
          {tab === 'Serviços' && (() => { const rows = services.filter(s => norm(`${s.name} ${s.description ?? ''}`).includes(norm(search.trim()))); return rows.length ? <div className="table-scroll"><table><thead><tr><th>Serviço</th><th>Descrição</th><th>Valor sugerido</th><th>Ações</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.description || '—'}</td><td>{cash(row.price)}</td><td><button className="text-button" onClick={() => setEditor({kind:'service',row})}><Pencil size={15}/>Editar</button></td></tr>)}</tbody></table></div> : <Empty icon={<Box/>} title={search ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'} description={search ? 'Tente buscar por outro nome.' : 'Adicione um serviço que você oferece.'} action={!search && newRecord}/>; })()}
          {tab === 'Mensalidades' && (filteredCharges.length ? chargeTable(filteredCharges) : <Empty icon={<CreditCard/>} title="Nenhuma mensalidade encontrada" description={ready ? 'Altere os filtros ou lance uma nova mensalidade.' : 'Cadastre primeiro um cliente e um serviço.'} action={newRecord}/>)}
        </section>}
      </>}
    </main>
    {editor && <EditDialog editor={editor} data={data} period={period} close={() => setEditor(null)} done={(message) => {setEditor(null);setNotice(message);}}/>}
    {notice && <output className="toast"><Check size={19}/>{notice}</output>}
  </div>;
}

function EditDialog({editor,data,period,close,done}: {editor:Editor; data:Data; period:string; close:()=>void; done:(message:string)=>void}) {
  const save = useLedgerActions();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [price,setPrice] = useState(editor.kind === 'charge' && editor.row ? String(editor.row.amount/100) : '');
  const isReversing = editor.kind === 'payment' && Boolean(editor.row.paidAt);
  const title = editor.kind === 'payment' ? (isReversing ? 'Estornar baixa' : 'Registrar pagamento') : editor.kind === 'client' ? (editor.row ? 'Editar cliente' : 'Novo cliente') : editor.kind === 'service' ? (editor.row ? 'Editar serviço' : 'Novo serviço') : (editor.row ? 'Editar mensalidade' : 'Nova mensalidade');
  useEffect(() => { dialog.current?.showModal(); }, []);

  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = new FormData(e.currentTarget);
    const text = (k:string) => String(payload.get(k) ?? '').trim();
    const amount = (k:string) => Math.round(Number(text(k).replace(',','.'))*100);
    setBusy(true); setError('');
    try {
      if (editor.kind === 'client') await save.client.mutateAsync({id:editor.row?.id,name:text('name'),email:text('email'),phone:text('phone')});
      else if (editor.kind === 'service') await save.service.mutateAsync({id:editor.row?.id,name:text('name'),description:text('description'),price:amount('price')});
      else if (editor.kind === 'charge') await save.charge.mutateAsync({id:editor.row?.id,clientId:text('clientId'),serviceId:text('serviceId'),period:text('period'),due:text('due'),amount:amount('amount')});
      else await save.payment.mutateAsync({id:editor.row.id,paidAt:isReversing ? null : text('paidAt')});
      done(editor.kind === 'payment' ? isReversing ? 'Baixa estornada.' : 'Pagamento registrado.' : 'Registro salvo.');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(message && /[áéíóúãçàê]/i.test(message) ? message : 'Não foi possível salvar. Verifique os dados e tente novamente.');
    } finally { setBusy(false); }
  }

  return <dialog ref={dialog} className="edit-dialog" aria-labelledby="dialog-title" onCancel={e=>{e.preventDefault();if(!busy)close();}}>
    <header><h2 id="dialog-title">{title}</h2><button className="action-icon" aria-label="Fechar" disabled={busy} onClick={close}><X size={21}/></button></header>
    <form onSubmit={submit}>
      {editor.kind === 'client' && <><label>Nome do cliente<input aria-label="Nome do cliente" name="name" maxLength={120} required defaultValue={editor.row?.name} placeholder="Nome ou razão social"/></label><label>E-mail <small>(opcional)</small><input aria-label="E-mail" name="email" type="email" maxLength={254} defaultValue={editor.row?.email ?? ''} placeholder="cliente@email.com"/></label><label>Telefone <small>(opcional)</small><input aria-label="Telefone" name="phone" type="tel" maxLength={40} defaultValue={editor.row?.phone ?? ''} placeholder="(00) 00000-0000"/></label></>}
      {editor.kind === 'service' && <><label>Nome do serviço<input aria-label="Nome do serviço" name="name" maxLength={120} required defaultValue={editor.row?.name} placeholder="Ex.: Manutenção de site"/></label><label>Valor sugerido (R$)<input aria-label="Valor sugerido (R$)" name="price" type="number" min="0.01" max="9999999.99" step="0.01" required defaultValue={editor.row ? editor.row.price/100 : ''} placeholder="0,00"/></label><label>Descrição <small>(opcional)</small><textarea aria-label="Descrição" name="description" maxLength={500} rows={3} defaultValue={editor.row?.description ?? ''}/></label></>}
      {editor.kind === 'charge' && <><label>Cliente<select aria-label="Cliente" name="clientId" required defaultValue={editor.row?.clientId ?? ''}><option value="" disabled>Selecione um cliente</option>{data.clients.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>Serviço<select aria-label="Serviço" name="serviceId" required defaultValue={editor.row?.serviceId ?? ''} onChange={e=>{const service=data.services.find(s=>s.id===e.target.value);if(service) setPrice(String(service.price/100));}}><option value="" disabled>Selecione um serviço</option>{data.services.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><div className="field-pair"><label>Competência<input aria-label="Competência" name="period" type="month" required defaultValue={editor.row?.period ?? (period || today().slice(0,7))}/></label><label>Vencimento<input aria-label="Vencimento" name="due" type="date" required defaultValue={editor.row?.due ?? today()}/></label></div><label>Valor da mensalidade (R$)<input aria-label="Valor da mensalidade (R$)" name="amount" type="number" min="0.01" max="9999999.99" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="0,00" required/></label></>}
      {editor.kind === 'payment' && <><p className="payment-summary"><strong>{cash(editor.row.amount)}</strong><span>{data.clients.find(c=>c.id===editor.row.clientId)?.name} · {monthLabel(editor.row.period)}</span></p>{isReversing ? <p>A baixa será removida do painel. Nenhum valor será devolvido por este sistema.</p> : <label>Data do pagamento<input aria-label="Data do pagamento" name="paidAt" type="date" defaultValue={today()} max={today()} required/></label>}</>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer><button className="secondary" type="button" onClick={close} disabled={busy}>Cancelar</button><button className="primary" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={16}/> Salvando…</> : editor.kind === 'payment' ? (isReversing ? 'Estornar baixa' : 'Confirmar pagamento') : 'Salvar'}</button></footer>
    </form>
  </dialog>;
}
