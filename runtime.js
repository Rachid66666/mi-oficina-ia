/* Runtime de Mi Oficina.
   Da al programa (index.html) lo que necesita fuera de Claude: cuentas de usuario, base de datos
   por cliente, IA, descargas y fotos. Todo va contra Supabase; la IA pasa por la función "ai",
   que guarda la clave de Anthropic en el servidor (nunca llega al navegador).
   Sin configuración arranca en modo demo (datos en el navegador). */
(function () {
  const cfg = window.APP_CONFIG || {};
  const live = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const sb = live ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const RT = { appName: cfg.appName || 'Mi Oficina', standalone: true, live, user: null };
  window.RT = RT;
  document.title = RT.appName;

  /* ---------------- sesión ---------------- */
  let readyResolve; const ready = new Promise(r => (readyResolve = r));
  if (live) {
    sb.auth.onAuthStateChange((ev, session) => {
      if (ev === 'PASSWORD_RECOVERY') { showLogin('newpass'); return; }
      if (session && session.user) {
        const first = !RT.user; RT.user = session.user; hideLogin();
        if (first) readyResolve(); else if (RT.user.id !== session.user.id) location.reload();
      } else if (RT.user) { location.reload(); }
    });
    sb.auth.getSession().then(({ data }) => { if (!data.session) showLogin('login'); });
  } else readyResolve();
  RT.logout = async () => { if (sb) await sb.auth.signOut(); location.reload(); };
  document.addEventListener('click', e => { if (e.target.closest('[data-rtlogout]')) RT.logout(); });

  /* ---------------- pantalla de acceso ---------------- */
  const css = `#rt-login{position:fixed;inset:0;z-index:9999;background:linear-gradient(160deg,#1f3fbf 0%,#2a4fe0 45%,#f4f6fb 45.1%);overflow:auto;display:flex;flex-direction:column;align-items:center;padding:calc(28px + env(safe-area-inset-top,0px)) 16px 28px;font-family:"Public Sans",system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f1733}
  #rt-login .top{width:100%;max-width:420px;color:#fff;margin-bottom:18px}
  #rt-login .lg{display:flex;align-items:center;gap:10px;font:700 1.5rem "Bricolage Grotesque",system-ui,sans-serif}
  #rt-login .lg svg{width:44px;height:44px;border-radius:12px;box-shadow:0 0 0 2px rgba(255,255,255,.35)}
  #rt-login .tag{margin:10px 0 0;font-size:1.05rem;line-height:1.4;opacity:.95}
  #rt-login .bx{width:100%;max-width:420px;background:#fff;border-radius:20px;padding:24px;box-shadow:0 16px 48px rgba(15,23,51,.18)}
  #rt-login h1{font:700 1.4rem "Bricolage Grotesque",system-ui,sans-serif;margin:0 0 4px}#rt-login p.sub{margin:0 0 14px;color:#566080;font-size:.95rem;line-height:1.45}
  #rt-login label{display:block;font-size:.9rem;font-weight:600;margin:12px 0 5px}#rt-login input{width:100%;box-sizing:border-box;padding:13px 14px;border-radius:12px;border:1px solid #dde2ee;background:#f8f9fd;color:#0f1733;font-size:16px}
  #rt-login input:focus{outline:2px solid #1f3fbf;outline-offset:1px;background:#fff}
  #rt-login button{width:100%;margin-top:18px;padding:14px;border:0;border-radius:12px;background:#1f3fbf;color:#fff;font-weight:700;font-size:1.05rem;cursor:pointer;box-shadow:0 4px 14px rgba(31,63,191,.3)}#rt-login button[disabled]{opacity:.6}
  #rt-login button.alt{background:#fff0e6;color:#c2410c;box-shadow:none;margin-top:10px}
  #rt-login .lk{display:flex;justify-content:center;gap:10px;margin-top:14px;font-size:.92rem}#rt-login a{color:#1f3fbf;cursor:pointer;text-decoration:underline;font-weight:600}
  #rt-login .msg{margin-top:12px;font-size:.95rem;min-height:1.2em;line-height:1.4}#rt-login .msg.err{color:#c0352b}#rt-login .msg.ok{color:#147a4b}
  #rt-login ul{list-style:none;padding:0;margin:18px 0 0;width:100%;max-width:420px;display:grid;gap:8px;font-size:.95rem;color:#566080}
  #rt-login li{display:flex;gap:10px;align-items:center;background:#fff;border:1px solid #dde2ee;border-radius:12px;padding:10px 12px}
  #rt-login li b{color:#0f1733}#rt-login li i{font-style:normal;width:30px;height:30px;border-radius:9px;background:#e8edff;display:grid;place-items:center;flex:none}`;
  function showLogin(mode) {
    if (!document.body) { document.addEventListener('DOMContentLoaded', () => showLogin(mode)); return; }
    let el = document.getElementById('rt-login');
    if (!el) {
      const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      el = document.createElement('div'); el.id = 'rt-login'; document.body.appendChild(el);
    }
    const t = {
      login: ['Entrar', 'Escribe el email y la contraseña con los que te registraste.', 'Entrar'],
      signup: ['Crea tu cuenta gratis', 'Solo tu email y una contraseña. Después te pedimos el nombre de tu negocio.', 'Crear mi cuenta'],
      reset: ['Recuperar contraseña', 'Te mandamos un email con un enlace para poner una nueva.', 'Enviar enlace'],
      newpass: ['Nueva contraseña', 'Escribe tu nueva contraseña.', 'Guardar contraseña']
    }[mode];
    const logo = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#1f3fbf"/><path d="M20 33.5l8 8 16-18" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="48" cy="16" r="6" fill="#ff7a2f"/></svg>';
    el.innerHTML = `<div class="top"><div class="lg">${logo}${esc(RT.appName)}</div><p class="tag"><b>Tú trabaja, del papeleo nos encargamos.</b><br>Presupuestos, facturas, clientes y agenda desde el móvil, en un minuto.</p></div>
      <form class="bx" id="rt-f"><h1>${t[0]}</h1><p class="sub">${t[1]}</p>
      ${mode !== 'newpass' ? '<label for="rt-em">Tu email</label><input id="rt-em" type="email" inputmode="email" autocomplete="email" placeholder="nombre@ejemplo.com" required>' : ''}
      ${mode !== 'reset' ? `<label for="rt-pw">${mode === 'login' ? 'Tu contraseña' : 'Elige una contraseña (mínimo 6 letras o números)'}</label><input id="rt-pw" type="password" minlength="6" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required>` : ''}
      <button type="submit">${t[2]}</button>${mode === 'login' ? '<button type="button" class="alt" data-m="signup">Soy nuevo: crear cuenta gratis</button>' : ''}<div class="msg" id="rt-msg"></div>
      <div class="lk">${mode === 'login' ? '<a data-m="reset">He olvidado la contraseña</a>' : mode === 'newpass' ? '' : '<a data-m="login">Ya tengo cuenta, quiero entrar</a>'}</div></form>
      ${mode === 'signup' || mode === 'login' ? '<ul><li><i>📄</i><span><b>Presupuestos en 1 minuto</b> con PDF para enviar por WhatsApp</span></li><li><i>💶</i><span><b>Facturas</b> con el número y los impuestos automáticos</span></li><li><i>🎙️</i><span><b>Háblale</b> y la IA lo apunta por ti</span></li></ul>' : ''}`;
    el.querySelectorAll('[data-m]').forEach(a => (a.onclick = () => showLogin(a.dataset.m)));
    const f = el.querySelector('#rt-f'), msg = el.querySelector('#rt-msg');
    const say = (m, ok) => { msg.textContent = m; msg.className = 'msg ' + (ok ? 'ok' : 'err'); };
    f.onsubmit = async e => {
      e.preventDefault(); const b = f.querySelector('button'); b.disabled = true; say('', true);
      const em = (f.querySelector('#rt-em') || {}).value, pw = (f.querySelector('#rt-pw') || {}).value;
      try {
        if (mode === 'login') { const { error } = await sb.auth.signInWithPassword({ email: em, password: pw }); if (error) throw error; }
        if (mode === 'signup') {
          const { data, error } = await sb.auth.signUp({ email: em, password: pw, options: { emailRedirectTo: location.origin + location.pathname } });
          if (error) throw error;
          if (!data.session) say('Te hemos enviado un email. Ábrelo y pulsa el enlace para activar tu cuenta.', true);
        }
        if (mode === 'reset') { const { error } = await sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname }); if (error) throw error; say('Listo. Revisa tu email.', true); }
        if (mode === 'newpass') { const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw error; say('Contraseña cambiada.', true); setTimeout(hideLogin, 800); }
      } catch (err) { say(trad(err)); }
      b.disabled = false;
    };
  }
  function hideLogin() { const el = document.getElementById('rt-login'); if (el) el.remove(); }
  function trad(e) {
    const m = (e && e.message) || String(e);
    if (/Invalid login/i.test(m)) return 'Email o contraseña incorrectos.';
    if (/Email not confirmed/i.test(m)) return 'Falta confirmar tu email: revisa tu bandeja de entrada.';
    if (/already registered/i.test(m)) return 'Ese email ya tiene cuenta. Entra con tu contraseña.';
    if (/at least 6/i.test(m)) return 'La contraseña necesita al menos 6 caracteres.';
    return m;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  /* ---------------- base de datos (una fila por documento, aislada por usuario) ---------------- */
  function makeDb() {
    const cache = {}; // coll -> Map(id -> data)
    const subs = {};  // coll -> [callbacks]
    const emit = c => { const m = cache[c] || new Map(); const docs = [...m.entries()].map(([id, data]) => ({ id, data: () => data })); (subs[c] || []).forEach(cb => { try { cb({ docs }); } catch (e) { console.error(e); } }); };
    async function load(c) {
      const out = new Map(); let from = 0;
      for (;;) {
        const { data, error } = await sb.from('docs').select('id,data').eq('coll', c).range(from, from + 999);
        if (error) throw error;
        data.forEach(r => out.set(r.id, r.data));
        if (data.length < 1000) break; from += 1000;
      }
      cache[c] = out; emit(c);
    }
    const timers = {};
    const refetch = c => { clearTimeout(timers[c]); timers[c] = setTimeout(() => load(c).catch(console.error), 400); };
    sb.channel('docs-' + RT.user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: 'user_id=eq.' + RT.user.id }, p => {
        const c = (p.new && p.new.coll) || (p.old && p.old.coll); if (c && subs[c]) refetch(c); else Object.keys(subs).forEach(refetch);
      })
      .subscribe();
    return {
      collection(c) {
        return {
          onSnapshot(cb, err) { (subs[c] = subs[c] || []).push(cb); load(c).catch(e => err && err(e)); return () => { subs[c] = subs[c].filter(x => x !== cb); }; },
          doc(id) {
            return {
              async set(data) {
                (cache[c] = cache[c] || new Map()).set(id, data); emit(c);
                const { error } = await sb.from('docs').upsert({ user_id: RT.user.id, coll: c, id, data, updated_at: new Date().toISOString() });
                if (error) { refetch(c); throw error; }
              },
              async delete() {
                if (cache[c]) cache[c].delete(id); emit(c);
                const { error } = await sb.from('docs').delete().eq('coll', c).eq('id', id);
                if (error) { refetch(c); throw error; }
              }
            };
          }
        };
      }
    };
  }

  /* ---------------- IA (Claude a través de la función del servidor) ---------------- */
  async function callAI(body) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(cfg.supabaseUrl.replace(/\/$/, '') + '/functions/v1/' + (cfg.aiFunction || 'ai'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + (data.session ? data.session.access_token : '') },
      body: JSON.stringify(body)
    });
    let j = null; try { j = await r.json(); } catch (e) { }
    if (!r.ok) { const er = (j && j.error) || {}; const e = new Error(er.message || (r.status === 404 ? 'La IA todavía no está activada en este programa. Mientras, puedes hacer el presupuesto a mano con «Nuevo presupuesto».' : 'La IA no responde (' + r.status + ')')); e.code = er.code || (r.status === 429 ? 'rate_limited' : 'error'); throw e; }
    return j;
  }
  const blobToB64 = b => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(b); });
  function makeSample() {
    async function sample(messages, opts = {}) {
      const defs = (opts.tools || []).map(t => ({ name: t.name, description: t.description || '', input_schema: t.inputSchema || t.input_schema || { type: 'object', properties: {} } }));
      const msgs = messages.map(m => ({ role: m.role, content: m.content }));
      let text = '';
      for (let turn = 0; turn < 10; turn++) {
        const r = await callAI({ messages: msgs, tools: defs, max_tokens: opts.maxTokens || 4096 });
        const blocks = r.content || [];
        const t = blocks.filter(b => b.type === 'text').map(b => b.text).join('');
        if (t) { text += (text ? '\n\n' : '') + t; if (opts.onText) opts.onText({ text }); }
        const uses = blocks.filter(b => b.type === 'tool_use');
        if (r.stop_reason !== 'tool_use' || !uses.length) break;
        msgs.push({ role: 'assistant', content: blocks });
        const results = [];
        for (const u of uses) {
          const tool = (opts.tools || []).find(x => x.name === u.name);
          let out;
          try { out = tool && tool.execute ? await tool.execute(u.input || {}) : { error: 'Herramienta desconocida' }; }
          catch (e) { out = { error: String((e && e.message) || e) }; }
          results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out == null ? { ok: true } : out) });
        }
        msgs.push({ role: 'user', content: results });
      }
      return { text };
    }
    sample.json = async (messages, opts = {}) => {
      const msgs = messages.map(m => ({ role: m.role, content: m.content }));
      if (opts.images && opts.images.length) {
        const first = msgs.find(m => m.role === 'user');
        const imgs = [];
        for (const b of opts.images) imgs.push({ type: 'image', source: { type: 'base64', media_type: b.type || 'image/jpeg', data: await blobToB64(b) } });
        first.content = [...imgs, { type: 'text', text: typeof first.content === 'string' ? first.content : JSON.stringify(first.content) }];
      }
      const r = await callAI({ messages: msgs, max_tokens: opts.maxTokens || 4096 });
      const t = (r.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      const m = t.match(/```(?:json)?\s*([\s\S]*?)```/) || t.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      try { return JSON.parse(m ? m[1] : t); } catch (e) { const er = new Error('La IA no devolvió datos válidos'); er.code = 'bad_json'; throw er; }
    };
    sample.limits = async () => ({ images: true });
    return sample;
  }

  /* ---------------- descargas y fotos ---------------- */
  const downloads = {
    async save({ filename, data, type }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: type || (/\.pdf$/i.test(filename) ? 'application/pdf' : /\.xlsx$/i.test(filename) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : /\.csv$/i.test(filename) ? 'text/csv' : 'text/html') });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      return { ok: true };
    }
  };
  const signed = {};
  const assets = {
    async upload(blob, o = {}) {
      const id = RT.user.id + '/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)) + '.jpg';
      const { error } = await sb.storage.from('fotos').upload(id, blob, { contentType: o.type || blob.type || 'image/jpeg' });
      if (error) throw error;
      return { id };
    }
  };
  // Las fotos son privadas: se piden con un enlace temporal y se repinta la pantalla al tenerlo.
  RT.assetUrl = id => {
    if (!sb) return '';
    const s = signed[id];
    if (s && s.url) return s.url;
    if (!s) {
      signed[id] = { pending: true };
      sb.storage.from('fotos').createSignedUrl(id, 3600).then(({ data }) => { signed[id] = { url: data && data.signedUrl }; if (typeof window.schedule === 'function') window.schedule(); else if (typeof window.render === 'function') window.render(); });
    }
    return '';
  };


  /* ---------------- suscripción (prueba gratis y pago con Stripe) ---------------- */
  async function callFn(name, body) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(cfg.supabaseUrl.replace(/\/$/, '') + '/functions/v1/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + (data.session ? data.session.access_token : '') },
      body: JSON.stringify(body || {})
    });
    let j = null; try { j = await r.json(); } catch (e) { }
    if (!r.ok) { const er = (j && j.error) || {}; const e = new Error(er.message || 'Error (' + r.status + ')'); e.code = er.code; throw e; }
    return j;
  }
  RT.billing = null;
  const daysLeft = iso => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000));
  async function refreshBilling() {
    try { RT.billing = await callFn('billing', { action: 'status' }); } catch (e) { RT.billing = null; }
    paintBanner(); if (typeof window.schedule === 'function') window.schedule();
  }
  function paintBanner() {
    let el = document.getElementById('rt-bill');
    const b = RT.billing;
    if (!b || b.paid) { if (el) el.remove(); document.body.style.paddingBottom = ''; return; }
    if (!el) {
      const st = document.createElement('style');
      st.textContent = `#rt-bill{position:fixed;left:0;right:0;bottom:0;z-index:900;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;padding:8px 14px;font:600 14px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#ff7a2f;color:#fff}
      #rt-bill.end{background:#b3261e;color:#fff}#rt-bill button{border:0;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;background:#fff;color:#c2410c}#rt-bill.end button{background:#fff;color:#b3261e}`;
      document.head.appendChild(st);
      el = document.createElement('div'); el.id = 'rt-bill'; document.body.appendChild(el);
    }
    const d = daysLeft(b.trialEnd);
    el.className = b.trial ? '' : 'end';
    el.innerHTML = b.trial
      ? `<span>Prueba gratis: te ${d === 1 ? 'queda 1 día' : 'quedan ' + d + ' días'}${cfg.priceLabel ? ' · después ' + esc(cfg.priceLabel) : ''}</span><button data-rtpay>Suscribirme</button>`
      : `<span>Tu prueba gratis ha terminado. Tus datos siguen aquí, pero la IA está en pausa.</span><button data-rtpay>Suscribirme${cfg.priceLabel ? ' · ' + esc(cfg.priceLabel) : ''}</button>`;
    document.body.style.paddingBottom = el.offsetHeight + 'px';
  }
  async function go(action) {
    try { const r = await callFn('billing', { action, returnUrl: location.origin + location.pathname }); if (r && r.url) location.href = r.url; }
    catch (e) { alertBox(e.message); }
  }
  function alertBox(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 4000); }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-rtpay]')) go('checkout');
    if (e.target.closest('[data-rtportal]')) go('portal');
  });
  RT.billingCard = () => {
    const b = RT.billing; if (!b) return '';
    const fd = iso => iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const txt = b.paid ? `<span class="pill ok">Suscripción activa</span> ${b.periodEnd ? 'Próxima renovación: ' + fd(b.periodEnd) + '.' : ''}`
      : b.trial ? `<span class="pill warn">Prueba gratis</span> Hasta el ${fd(b.trialEnd)}.`
        : '<span class="pill bad">Prueba terminada</span> Suscríbete para volver a usar la IA.';
    return `<div class="card"><h2>Tu suscripción</h2><p style="margin-bottom:10px">${txt}</p>${b.paid ? '<button class="btn" data-rtportal>Gestionar pago o darme de baja</button>' : `<button class="btn primary" data-rtpay>Suscribirme${cfg.priceLabel ? ' · ' + esc(cfg.priceLabel) : ''}</button>`}</div>`;
  };
  if (live) ready.then(() => {
    refreshBilling();
    if (/[?&]pago=ok/.test(location.search)) {
      history.replaceState(null, '', location.pathname);
      alertBox('¡Gracias! Estamos activando tu suscripción…');
      setTimeout(refreshBilling, 4000); setTimeout(refreshBilling, 12000);
    }
  });


  /* ---------------- hablarle a la IA (micrófono) ---------------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    const st = document.createElement('style');
    st.textContent = `.rt-mic{flex:none;width:44px;height:44px;border-radius:50%;border:1px solid var(--line,#ccc);background:var(--card,#fff);color:inherit;display:grid;place-items:center;cursor:pointer}
    .rt-mic svg{width:20px;height:20px}.rt-mic.on{background:#b3261e;border-color:#b3261e;color:#fff;animation:rtpulse 1.2s infinite}
    @keyframes rtpulse{50%{box-shadow:0 0 0 8px rgba(179,38,30,.15)}}`;
    (document.head || document.documentElement).appendChild(st);
    const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
    let rec = null;
    const addMics = () => document.querySelectorAll('form.chat-in').forEach(f => {
      if (f.querySelector('.rt-mic')) return;
      const ta = f.querySelector('textarea'); if (!ta) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'rt-mic'; b.innerHTML = icon; b.title = 'Habla y se envía solo'; b.setAttribute('aria-label', 'Hablar');
      b.onclick = () => {
        if (rec) { rec.stop(); return; }
        rec = new SR();
        rec.lang = /^es/i.test(navigator.language || '') ? navigator.language : 'es-ES';
        rec.interimResults = true; rec.continuous = false;
        const base = ta.value ? ta.value.replace(/\s*$/, ' ') : '';
        let finalText = '';
        rec.onresult = ev => {
          let interim = '';
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const t = ev.results[i][0].transcript;
            if (ev.results[i].isFinal) finalText += t; else interim += t;
          }
          ta.value = base + finalText + interim; ta.dispatchEvent(new Event('input', { bubbles: true }));
        };
        rec.onerror = ev => { if (ev.error === 'not-allowed') alert('Da permiso al micrófono en tu navegador para poder hablarle.'); };
        rec.onend = () => {
          b.classList.remove('on'); rec = null;
          if (finalText.trim()) { if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event('submit', { cancelable: true })); }
        };
        b.classList.add('on'); rec.start();
      };
      const send = f.querySelector('button[type="submit"], button.primary');
      f.insertBefore(b, send || null);
    });
    const start = () => { addMics(); new MutationObserver(addMics).observe(document.body, { childList: true, subtree: true }); };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  }

  /* ---------------- lo que pide el programa ---------------- */
  RT.use = async name => {
    if (!live) {
      const host = window.claude && window.claude.use ? window.claude : null; // abierto dentro de Claude
      // Modo demo: datos en el navegador; si se abre dentro de Claude, usa su IA.
      if (name === 'db' || name === 'mcp' || name === 'assets') return null;
      if (name === 'downloads') return host ? host.use('downloads').catch(() => downloads) : downloads;
      if (name === 'sample') return host ? host.use('sample').catch(() => null) : null;
      return null;
    }
    await ready;
    if (name === 'db') return RT._db || (RT._db = makeDb());
    if (name === 'sample') return RT._sm || (RT._sm = makeSample());
    if (name === 'downloads') return downloads;
    if (name === 'assets') return assets;
    return null; // mcp: Calendar y Gmail se usan por enlace
  };
})();
