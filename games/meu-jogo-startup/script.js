/**
 * STARTUP TYCOON — LÓGICA DO JOGO E MODULARIZAÇÃO
 * Autor: Lucas Matheus
 * Professor Auxiliar: Leandro Martis
 * Escola: Colégio Cívico Militar Douradina | Turma: 2º C (Administração)
 */

(() => {
  'use strict';

  /* ============================================================
     CONFIGURAÇÕES E CONSTANTES DO JOGO
     ============================================================ */
  const SAVE_KEY             = 'StartupTycoonSave_v3';
  const AUTOSAVE_INTERVAL    = 10_000; // 10 segundos
  const OFFLINE_EFFICIENCY   = 0.5;    // 50% de faturamento offline
  const OFFLINE_MIN_SECONDS  = 30;
  const EVENT_INTERVAL       = 45;     // Checa evento a cada 45s
  const EVENT_CHANCE         = 0.6;    // 60% de chance de ocorrer evento
  const MAX_TOASTS           = 4;
  const MAX_LOG_ENTRIES      = 50;

  /* ============================================================
     BASE DE DADOS DO JOGO
     ============================================================ */
  const STAGES = [
    { name: 'Garagem do Fundador',  cost: 5_000,      rpsMult: 1.00, icon: 'fa-warehouse',   desc: 'Sua jornada começa na garagem dos seus pais com apenas um notebook antigo.' },
    { name: 'Espaço Coworking',     cost: 50_000,     rpsMult: 1.50, icon: 'fa-mug-saucer',  desc: 'Uma mesa alugada em ambiente compartilhado com café liberado e networking.' },
    { name: 'Escritório Próprio',   cost: 350_000,    rpsMult: 2.00, icon: 'fa-building',    desc: 'Seu próprio andar comercial com sala de reunião e quadro de tarefas.' },
    { name: 'Sede Corporativa',     cost: 2_500_000,  rpsMult: 3.00, icon: 'fa-city',        desc: 'Um prédio inteiro com o logo da sua empresa no topo da cidade.' },
    { name: 'Conglomerado Global',  cost: 25_000_000, rpsMult: 5.00, icon: 'fa-globe',       desc: 'Domínio tecnológico global com filiais em Tóquio, Vale do Silício e Londres.' }
  ];

  const EMPLOYEES = [
    { id: 'intern',        name: 'Estagiário de Dev',       baseCost: 15,        baseRps: 0.5,   icon: 'fa-user-graduate', color: 'text-slate-400',   desc: 'Faz café, resolve pequenos bugs e conserta a formatação do HTML.' },
    { id: 'jr_dev',        name: 'Desenvolvedor Júnior',    baseCost: 100,       baseRps: 4,     icon: 'fa-code',          color: 'text-blue-400',    desc: 'Entrega sprints completas e utiliza bibliotecas prontas.' },
    { id: 'sr_dev',        name: 'Desenvolvedor Sênior',    baseCost: 1_100,     baseRps: 32,    icon: 'fa-user-ninja',    color: 'text-purple-400',  desc: 'Resolve arquiteturas complexas e refatora código legado em minutos.' },
    { id: 'tech_lead',     name: 'Tech Lead',               baseCost: 12_000,    baseRps: 260,   icon: 'fa-user-tie',      color: 'text-amber-400',   desc: 'Gerencia a equipe, define prazos e reduz débitos técnicos.' },
    { id: 'ai_architect',  name: 'Arquiteto de IA',         baseCost: 130_000,   baseRps: 1_400, icon: 'fa-brain',       color: 'text-emerald-400', desc: 'Cria modelos de IA autônomos para gerar receita contínua.' },
    { id: 'cto_executive', name: 'Diretor de Tecnologia',   baseCost: 1_400_000, baseRps: 7_800, icon: 'fa-crown',     color: 'text-rose-400',    desc: 'Comanda todo o ecossistema tecnológico e atrai investimentos multimilionários.' }
  ];

  const UPGRADES = [
    { id: 'coffee_machine',    name: 'Cafeteira Expresso',        cost: 100,     type: 'click',      multiplier: 2,    icon: 'fa-mug-hot',     desc: 'Dobra o ganho de capital por clique manual.' },
    { id: 'ergonomic_chairs',  name: 'Cadeiras Ergonômicas',      cost: 500,     type: 'energy',     energyBonus: 50,  icon: 'fa-chair',       desc: 'Aumenta a energia máxima em +50 pontos.' },
    { id: 'cloud_servers',     name: 'Servidores em Nuvem',       cost: 2_500,   type: 'global_rps', multiplier: 1.25, icon: 'fa-server',      desc: 'Aumenta a eficiência de toda a renda passiva em +25%.' },
    { id: 'viral_marketing',   name: 'Campanha Viral no TikTok',  cost: 15_000,  type: 'reputation', repBonus: 100,    icon: 'fa-bullhorn',    desc: 'Concede +100 de Reputação instantaneamente.' },
    { id: 'ai_copilot',        name: 'Ferramentas de IA para Devs', cost: 80_000, type: 'click',    multiplier: 3,    icon: 'fa-robot',       desc: 'Gera sugestões de código automáticas, triplicando o poder do clique.' },
    { id: 'global_seo',        name: 'Dominância de SEO Global',  cost: 500_000, type: 'global_rps', multiplier: 1.5,  icon: 'fa-chart-line',  desc: 'Aumenta toda a renda passiva por segundo em +50%.' }
  ];

  const EVENTS = [
    {
      id: 'hacker_attack',
      title: 'Ataque de Hacker!',
      desc: 'Sua infraestrutura está sob ataque DDoS! Qual é a sua estratégia?',
      icon: 'fa-user-secret',
      options: [
        {
          label: 'Pagar Resgate (-15% do capital)',
          action: (s) => {
            const penalty = Math.round(s.money * 0.15) + 50;
            s.money = Math.max(0, s.money - penalty);
            toast(`Resgate pago. -R$ ${fmt(penalty)}`, 'warning');
            logNews(`Ataque Hacker: Pago resgate de R$ ${fmt(penalty)}.`);
          }
        },
        {
          label: 'Contratar Especialista (-10 Reputação)',
          action: (s) => {
            if (s.reputation >= 10) {
              s.reputation -= 10;
              toast('Servidores protegidos!', 'success');
              logNews('Ataque Hacker: Neutralizado com 10 Reputação.');
            } else {
              const penalty = Math.round(s.money * 0.25);
              s.money = Math.max(0, s.money - penalty);
              toast('Reputação insuficiente! Sistema caiu.', 'error');
              logNews(`Ataque Hacker: Falha. Prejuízo de R$ ${fmt(penalty)}.`);
            }
          }
        }
      ]
    },
    {
      id: 'angel_investor',
      title: 'Proposta de Investimento Anjo!',
      desc: 'Um fundo de venture capital se interessou pelo seu crescimento acelerado.',
      icon: 'fa-hand-holding-dollar',
      options: [
        {
          label: 'Aceitar Aporte Financeiro',
          action: (s) => {
            const bonus = Math.round(s.totalEarned * 0.2) + 500;
            s.money += bonus;
            s.totalEarned += bonus;
            toast(`Investimento: +R$ ${fmt(bonus)}!`, 'success');
            logNews(`Aporte Anjo: Recebido R$ ${fmt(bonus)}.`);
          }
        },
        {
          label: 'Recusar e Manter Controle (+25 Reputação)',
          action: (s) => {
            s.reputation += 25;
            toast('Independência mantida! +25 Reputação', 'info');
            logNews('Aporte Anjo: Recusado. +25 Reputação.');
          }
        }
      ]
    }
  ];

  /* ============================================================
     ESTADO INICIAL DO JOGO
     ============================================================ */
  const buildDefaultState = () => ({
    money: 0,
    totalEarned: 0,
    reputation: 0,
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    energy: 100,
    maxEnergy: 100,
    clickPower: 1,
    totalClicks: 0,
    playTimeSeconds: 0,
    stageIndex: 0,
    buyAmount: 1,
    soundEnabled: true,
    lastTickTimestamp: Date.now(),
    employees: {},
    upgrades: {}
  });

  let state = buildDefaultState();
  let activeEvent = null;

  /* ============================================================
     REFERÊNCIAS DOM E CACHE
     ============================================================ */
  const $ = (id) => document.getElementById(id);
  const dom = {};
  const employeeRefs = {};

  function cacheDomRefs() {
    Object.assign(dom, {
      screenMenu:            $('screenMenu'),
      screenCredits:         $('screenCredits'),
      btnPlayGame:           $('btnPlayGame'),
      btnOpenCredits:        $('btnOpenCredits'),
      btnCloseCredits:       $('btnCloseCredits'),
      btnBackToMenu:         $('btnBackToMenu'),
      buyMultiplierContainer:$('buyMultiplierContainer'),
      companyLogo:           $('companyLogo'),
      companyName:           $('companyName'),
      stageBadge:            $('stageBadge'),
      resMoney:              $('resMoney'),
      resRps:                $('resRps'),
      resReputation:         $('resReputation'),
      resLevel:              $('resLevel'),
      xpBar:                 $('xpBar'),
      statClickPower:        $('statClickPower'),
      energyText:            $('energyText'),
      energyBar:             $('energyBar'),
      statTotalEarned:       $('statTotalEarned'),
      statTotalClicks:       $('statTotalClicks'),
      statPlayTime:          $('statPlayTime'),
      statTotalEmployees:    $('statTotalEmployees'),
      nextStageCostText:     $('nextStageCostText'),
      stageDesc:             $('stageDesc'),
      stageProgressBar:      $('stageProgressBar'),
      btnUpgradeStage:       $('btnUpgradeStage'),
      btnAudio:              $('btnAudio'),
      tabEmployees:          $('tabEmployees'),
      tabUpgrades:           $('tabUpgrades'),
      tabEvents:             $('tabEvents'),
      tabBtnEmployees:       $('tabBtnEmployees'),
      tabBtnUpgrades:        $('tabBtnUpgrades'),
      tabBtnEvents:          $('tabBtnEvents'),
      eventBadge:            $('eventBadge'),
      activeEventCard:       $('activeEventCard'),
      eventIconContainer:    $('eventIconContainer'),
      eventTitle:            $('eventTitle'),
      eventDescription:      $('eventDescription'),
      eventOptionsContainer: $('eventOptionsContainer'),
      newsFeedLog:           $('newsFeedLog'),
      resetModal:            $('resetModal'),
      toastContainer:        $('toastContainer'),
      floatingOverlay:       $('floatingOverlay'),
      btnWork:               $('btnWork')
    });
  }

  /* ============================================================
     FUNÇÕES MATEMÁTICAS E CÁLCULO DE COMPRAS EM LOTE
     ============================================================ */
  function fmt(n, d = 2) {
    if (!isFinite(n)) return '∞';
    const abs = Math.abs(n);
    if (abs >= 1e12) return (n / 1e12).toFixed(2).replace('.', ',') + 'T';
    if (abs >= 1e9)  return (n / 1e9).toFixed(2).replace('.', ',')  + 'B';
    if (abs >= 1e6)  return (n / 1e6).toFixed(2).replace('.', ',')  + 'M';
    if (abs >= 1e4)  return Math.floor(n).toLocaleString('pt-BR');
    return n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function getEmployeeBulkCost(emp, amount) {
    const currentCount = state.employees[emp.id] || 0;
    const rate = 1.15;
    const baseCurrentCost = emp.baseCost * Math.pow(rate, currentCount);
    
    if (amount === 1) return Math.floor(baseCurrentCost);
    
    const totalCost = baseCurrentCost * ((Math.pow(rate, amount) - 1) / (rate - 1));
    return Math.floor(totalCost);
  }

  function getEmployeeRps(emp) {
    const count = state.employees[emp.id] || 0;
    return emp.baseRps * count;
  }

  function getTotalRps() {
    let base = 0;
    for (const emp of EMPLOYEES) base += getEmployeeRps(emp);

    let upgradeMult = 1;
    for (const upg of UPGRADES) {
      if (state.upgrades[upg.id] && upg.type === 'global_rps') upgradeMult *= upg.multiplier;
    }

    const stageMult = STAGES[state.stageIndex]?.rpsMult ?? 1;
    return base * upgradeMult * stageMult;
  }

  function getEffectiveClickPower() {
    let power = state.clickPower;
    for (const upg of UPGRADES) {
      if (state.upgrades[upg.id] && upg.type === 'click') power *= upg.multiplier;
    }
    const repBonus = 1 + state.reputation * 0.005;
    return Math.round(power * repBonus * 100) / 100;
  }

  /* ============================================================
     SISTEMA DE ÁUDIO SINTETIZADO (Web Audio API)
     ============================================================ */
  let audioCtx = null;
  function ensureAudioCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playSound(type) {
    if (!state.soundEnabled) return;
    const ctx = ensureAudioCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const presets = {
      click:   { type: 'sine',     freqs: [600, 800],   dur: 0.05, vol: 0.15 },
      buy:     { type: 'triangle', freqs: [300, 500],   dur: 0.15, vol: 0.20 },
      event:   { type: 'square',   freqs: [400, 300],   dur: 0.25, vol: 0.20 },
      levelUp: { type: 'sine',     freqs: [440, 554.37, 659.25], dur: 0.35, vol: 0.25 }
    };

    const p = presets[type] || presets.click;
    osc.type = p.type;
    p.freqs.forEach((f, i) => {
      osc.frequency.setValueAtTime(f, now + (p.dur / p.freqs.length) * i);
    });
    gain.gain.setValueAtTime(p.vol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + p.dur);
    osc.start(now);
    osc.stop(now + p.dur);
  }

  function toggleAudio() {
    state.soundEnabled = !state.soundEnabled;
    dom.btnAudio.innerHTML = state.soundEnabled 
      ? '<i class="fa-solid fa-volume-high"></i>' 
      : '<i class="fa-solid fa-volume-xmark"></i>';
    toast(state.soundEnabled ? 'Som ativado' : 'Som desativado', 'info');
  }

  /* ============================================================
     SISTEMA DE EVENTOS DINÂMICOS (CORRIGIDO)
     ============================================================ */
  function triggerRandomEvent() {
    if (activeEvent) return; // Se já houver um evento ativo, não dispara outro

    const randomEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    activeEvent = randomEvent;

    playSound('event');
    toast(`⚠️ Novo evento: ${randomEvent.title}`, 'warning');
    logNews(`ALERTA: O evento "${randomEvent.title}" apareceu!`);

    renderActiveEvent();
  }

  function renderActiveEvent() {
    if (!activeEvent) {
      if (dom.activeEventCard) dom.activeEventCard.classList.add('hidden');
      if (dom.eventBadge) dom.eventBadge.classList.add('hidden');
      return;
    }

    if (dom.eventBadge) dom.eventBadge.classList.remove('hidden');
    if (dom.activeEventCard) dom.activeEventCard.classList.remove('hidden');

    if (dom.eventIconContainer) dom.eventIconContainer.innerHTML = `<i class="fa-solid ${activeEvent.icon}"></i>`;
    if (dom.eventTitle) dom.eventTitle.textContent = activeEvent.title;
    if (dom.eventDescription) dom.eventDescription.textContent = activeEvent.desc;

    if (dom.eventOptionsContainer) {
      dom.eventOptionsContainer.innerHTML = '';
      activeEvent.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'w-full py-2.5 px-4 bg-slate-800 hover:bg-purple-600 text-white font-bold text-xs rounded-xl transition border border-slate-700 hover:border-purple-500 text-left flex items-center justify-between';
        btn.innerHTML = `<span>${opt.label}</span> <i class="fa-solid fa-chevron-right text-[10px] text-slate-400"></i>`;
        btn.addEventListener('click', () => {
          opt.action(state);
          activeEvent = null;
          renderActiveEvent();
          updateUI();
        });
        dom.eventOptionsContainer.appendChild(btn);
      });
    }
  }

  /* ============================================================
     AÇÕES DO JOGADOR
     ============================================================ */
  function doWork(clickEvent) {
    if (state.energy < 1) {
      toast('Sem energia! Tome um café.', 'warning');
      return;
    }
    const gain = getEffectiveClickPower();
    state.money += gain;
    state.totalEarned += gain;
    state.energy -= 1;
    state.totalClicks += 1;
    addXp(1);
    playSound('click');

    spawnFloatingText(clickEvent, `+R$ ${fmt(gain)}`, 'text-emerald-400 text-sm');
    updateUI();
  }

  function drinkCoffee() {
    if (state.energy >= state.maxEnergy) {
      toast('Energia máxima!', 'info');
      return;
    }
    if (state.money < 10) {
      toast('Requer R$ 10,00 para o café.', 'error');
      return;
    }
    state.money -= 10;
    state.energy = Math.min(state.maxEnergy, state.energy + 40);
    playSound('buy');
    toast('Café tomado! +40 Energia', 'success');
    updateUI();
  }

  function doNetworking() {
    if (state.energy < 15) {
      toast('Energia insuficiente (requer 15⚡).', 'warning');
      return;
    }
    state.energy -= 15;
    state.reputation += 1;
    addXp(5);
    playSound('click');
    toast('Contato feito! +1 Reputação', 'success');
    updateUI();
  }

  function addXp(amount) {
    state.xp += amount;
    while (state.xp >= state.xpToNextLevel) {
      state.xp -= state.xpToNextLevel;
      state.level += 1;
      state.xpToNextLevel = Math.round(state.xpToNextLevel * 1.5);
      playSound('levelUp');
      toast(`🎉 Nível ${state.level} alcançado!`, 'success');
      logNews(`Evolução: Startup atingiu o Nível ${state.level}.`);
    }
  }

  function setBuyAmount(amount) {
    state.buyAmount = amount;
    const buttons = dom.buyMultiplierContainer.querySelectorAll('.buy-mult-btn');
    buttons.forEach((btn) => {
      const isSelected = parseInt(btn.dataset.amount, 10) === amount;
      btn.classList.toggle('active', isSelected);
      btn.classList.toggle('bg-purple-600', isSelected);
      btn.classList.toggle('text-white', isSelected);
      btn.classList.toggle('text-slate-400', !isSelected);
    });
    updateUI();
  }

  function buyEmployee(id) {
    const emp = EMPLOYEES.find((e) => e.id === id);
    if (!emp) return;

    const amount = state.buyAmount;
    const totalCost = getEmployeeBulkCost(emp, amount);

    if (state.money < totalCost) {
      toast('Capital insuficiente!', 'error');
      return;
    }

    state.money -= totalCost;
    state.employees[id] = (state.employees[id] || 0) + amount;
    playSound('buy');
    toast(`${amount}x ${emp.name} contratado(s)!`, 'success');
    logNews(`Contratação: +${amount} ${emp.name}.`);
    updateUI();
  }

  function buyUpgrade(id) {
    const upg = UPGRADES.find((u) => u.id === id);
    if (!upg || state.upgrades[id]) return;
    if (state.money < upg.cost) {
      toast('Capital insuficiente!', 'error');
      return;
    }
    state.money -= upg.cost;
    state.upgrades[id] = true;

    if (upg.type === 'energy') {
      state.maxEnergy += upg.energyBonus;
      state.energy = state.maxEnergy;
    } else if (upg.type === 'reputation') {
      state.reputation += upg.repBonus;
    }

    playSound('buy');
    toast(`Upgrade: ${upg.name}!`, 'success');
    logNews(`Infraestrutura: "${upg.name}" adquirido.`);
    updateUI();
    updateUpgradesUI();
  }

  function upgradeStage() {
    const nextIdx = state.stageIndex + 1;
    if (nextIdx >= STAGES.length) return;
    const next = STAGES[nextIdx];
    if (state.money < next.cost) {
      toast('Capital insuficiente!', 'error');
      return;
    }
    state.money -= next.cost;
    state.stageIndex = nextIdx;
    playSound('levelUp');
    toast(`🏢 Nova fase: ${next.name}!`, 'success');
    logNews(`EXPANSÃO: A empresa chegou em "${next.name}"!`);
    updateUI();
  }

  /* ============================================================
     INTERFACE E ELEMENTOS DINÂMICOS
     ============================================================ */
  function spawnFloatingText(evt, text, colorClass) {
    const el = document.createElement('div');
    el.className = `floating-text ${colorClass}`;

    let x, y;
    if (evt && typeof evt.clientX === 'number') {
      x = evt.clientX;
      y = evt.clientY;
    } else {
      const r = dom.btnWork.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.textContent = text;

    dom.floatingOverlay.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  function toast(message, type = 'info') {
    const c = dom.toastContainer;
    while (c.children.length >= MAX_TOASTS) c.firstElementChild.remove();

    const styles = {
      success: 'bg-emerald-950 border-emerald-800 text-emerald-200',
      error:   'bg-rose-950 border-rose-800 text-rose-200',
      warning: 'bg-amber-950 border-amber-800 text-amber-200',
      info:    'bg-slate-800 border-slate-700 text-white'
    };

    const el = document.createElement('div');
    el.className = `px-4 py-2.5 rounded-xl border shadow-xl text-xs font-semibold flex items-center gap-2 transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto ${styles[type] || styles.info}`;
    el.textContent = message;

    c.appendChild(el);
    requestAnimationFrame(() => el.classList.remove('translate-y-2', 'opacity-0'));

    setTimeout(() => {
      el.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  function logNews(message) {
    if (dom.newsFeedLog.children.length === 1 && dom.newsFeedLog.firstElementChild?.classList.contains('italic')) {
      dom.newsFeedLog.innerHTML = '';
    }

    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const item = document.createElement('div');
    item.className = 'text-xs p-2 bg-slate-800/40 rounded-lg border border-slate-800/80 flex items-start space-x-2';
    item.innerHTML = `<span class="text-slate-500 font-mono flex-shrink-0">${time}</span><span class="text-slate-300">${message}</span>`;

    dom.newsFeedLog.prepend(item);
    while (dom.newsFeedLog.children.length > MAX_LOG_ENTRIES) dom.newsFeedLog.lastElementChild.remove();
  }

  /* ============================================================
     GERENCIAMENTO DE TELA E NAVEGAÇÃO
     ============================================================ */
  function openCredits() {
    dom.screenCredits.classList.remove('hidden');
  }

  function closeCredits() {
    dom.screenCredits.classList.add('hidden');
  }

  function startGame() {
    dom.screenMenu.classList.add('hidden');
  }

  function switchTab(name) {
    dom.tabEmployees.classList.toggle('hidden', name !== 'employees');
    dom.tabUpgrades.classList.toggle('hidden', name !== 'upgrades');
    dom.tabEvents.classList.toggle('hidden', name !== 'events');

    const TAB_BASE = 'px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2';
    const TAB_IDLE = `${TAB_BASE} bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800`;
    const TAB_ACTIVE = `${TAB_BASE} bg-purple-600 text-white shadow-lg shadow-purple-600/20`;

    dom.tabBtnEmployees.className = name === 'employees' ? TAB_ACTIVE : TAB_IDLE;
    dom.tabBtnUpgrades.className  = name === 'upgrades'  ? TAB_ACTIVE : TAB_IDLE;
    dom.tabBtnEvents.className    = name === 'events'    ? `${TAB_ACTIVE} relative` : `${TAB_IDLE} relative`;
  }

  /* ============================================================
     RENDERIZAÇÃO DAS LISTAS E ATUALIZAÇÃO DO DOM
     ============================================================ */
  function buildEmployeesList() {
    dom.tabEmployees.innerHTML = '';
    for (const emp of EMPLOYEES) {
      const card = document.createElement('div');
      card.className = 'bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between transition shadow-lg';
      card.innerHTML = `
        <div>
          <div class="flex justify-between items-start mb-2">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center ${emp.color} text-lg">
                <i class="fa-solid ${emp.icon}"></i>
              </div>
              <div>
                <h4 class="text-sm font-bold text-white">${emp.name}</h4>
                <span class="text-[11px] text-slate-400">+R$ ${emp.baseRps.toLocaleString('pt-BR')}/s cada</span>
              </div>
            </div>
            <span data-count class="text-xs font-black text-purple-400 bg-purple-950/60 border border-purple-800/40 px-2 py-0.5 rounded-lg">x0</span>
          </div>
          <p class="text-xs text-slate-400 mb-3 leading-relaxed">${emp.desc}</p>
        </div>
        <div class="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
          <div class="text-xs">
            <span class="text-slate-500 block text-[10px]">Gera Total:</span>
            <span data-rps-total class="font-semibold text-blue-400">+R$ 0,00/s</span>
          </div>
          <button data-action="buy-employee" data-id="${emp.id}" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs rounded-xl transition border border-emerald-400/30">
            R$ <span data-cost>0</span>
          </button>
        </div>
      `;
      dom.tabEmployees.appendChild(card);
      employeeRefs[emp.id] = {
        count:    card.querySelector('[data-count]'),
        rpsTotal: card.querySelector('[data-rps-total]'),
        costSpan: card.querySelector('[data-cost]'),
        button:   card.querySelector('button')
      };
    }
  }

  function buildUpgradesList() {
    dom.tabUpgrades.innerHTML = '';
    for (const upg of UPGRADES) {
      const card = document.createElement('div');
      card.className = 'bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between transition shadow-lg';
      card.dataset.upgradeCard = upg.id;
      card.innerHTML = `
        <div>
          <div class="flex justify-between items-start mb-2">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-amber-400 text-lg">
                <i class="fa-solid ${upg.icon}"></i>
              </div>
              <div>
                <h4 class="text-sm font-bold text-white">${upg.name}</h4>
                <span class="text-[10px] text-slate-400">Melhoria Única</span>
              </div>
            </div>
            <span data-badge class="hidden text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-800">Adquirido</span>
          </div>
          <p class="text-xs text-slate-400 mb-3 leading-relaxed">${upg.desc}</p>
        </div>
        <div class="pt-3 border-t border-slate-800 flex items-center justify-end">
          <button data-action="buy-upgrade" data-id="${upg.id}" class="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs rounded-xl transition border border-indigo-400/30">
            Comprar por R$ ${upg.cost.toLocaleString('pt-BR')}
          </button>
        </div>
      `;
      dom.tabUpgrades.appendChild(card);
    }
  }

  function updateUI() {
    dom.resMoney.textContent = `R$ ${fmt(state.money)}`;
    dom.resRps.textContent = `+R$ ${fmt(getTotalRps())}/s`;
    dom.resReputation.textContent = state.reputation.toLocaleString('pt-BR');
    dom.resLevel.textContent = state.level;

    dom.xpBar.style.width = `${Math.min(100, (state.xp / state.xpToNextLevel) * 100)}%`;
    dom.statClickPower.textContent = `R$ ${fmt(getEffectiveClickPower())}`;
    dom.energyText.textContent = `${Math.floor(state.energy)} / ${state.maxEnergy}`;
    dom.energyBar.style.width = `${(state.energy / state.maxEnergy) * 100}%`;

    const stage = STAGES[state.stageIndex];
    dom.stageBadge.textContent = `Fase ${state.stageIndex + 1}: ${stage.name}`;

    const nextIdx = state.stageIndex + 1;
    if (nextIdx < STAGES.length) {
      const next = STAGES[nextIdx];
      dom.nextStageCostText.textContent = `R$ ${fmt(next.cost, 0)}`;
      dom.stageDesc.textContent = next.desc;
      dom.stageProgressBar.style.width = `${Math.min(100, (state.money / next.cost) * 100)}%`;
      dom.btnUpgradeStage.disabled = state.money < next.cost;
    } else {
      dom.nextStageCostText.textContent = 'Máximo';
      dom.stageProgressBar.style.width = '100%';
      dom.btnUpgradeStage.disabled = true;
    }

    dom.statTotalEarned.textContent = `R$ ${fmt(state.totalEarned)}`;
    dom.statTotalClicks.textContent = state.totalClicks.toLocaleString('pt-BR');

    for (const emp of EMPLOYEES) {
      const ref = employeeRefs[emp.id];
      if (!ref) continue;
      const count = state.employees[emp.id] || 0;
      const bulkCost = getEmployeeBulkCost(emp, state.buyAmount);
      const rps = getEmployeeRps(emp);

      ref.count.textContent = `x${count}`;
      ref.rpsTotal.textContent = `+R$ ${fmt(rps)}/s`;
      ref.costSpan.textContent = fmt(bulkCost, 0);
      ref.button.disabled = state.money < bulkCost;
    }
  }

  function updateUpgradesUI() {
    for (const upg of UPGRADES) {
      const card = dom.tabUpgrades.querySelector(`[data-upgrade-card="${upg.id}"]`);
      if (!card) continue;
      const bought = !!state.upgrades[upg.id];
      const button = card.querySelector('button');
      const badge = card.querySelector('[data-badge]');

      if (bought) {
        card.classList.add('border-emerald-800/40', 'bg-emerald-950/10');
        badge.classList.remove('hidden');
        button.classList.add('hidden');
      } else {
        button.disabled = state.money < upg.cost;
      }
    }
  }

  /* ============================================================
     PERSISTÊNCIA (SAVE / LOAD / RESET)
     ============================================================ */
  function saveGame() {
    state.lastTickTimestamp = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {}
  }

  function loadGame() {
    let raw;
    try { raw = localStorage.getItem(SAVE_KEY); } catch {}
    if (!raw) return;

    try {
      const loaded = JSON.parse(raw);
      state = Object.assign(buildDefaultState(), loaded);
      setBuyAmount(state.buyAmount || 1);
    } catch {}
  }

  function confirmReset() {
    try { localStorage.removeItem(SAVE_KEY); } catch {}
    state = buildDefaultState();
    activeEvent = null;
    renderActiveEvent();
    dom.resetModal.classList.add('hidden');
    updateUI();
    updateUpgradesUI();
    toast('Progresso reiniciado com sucesso!', 'info');
  }

  /* ============================================================
     LOOP PRINCIPAL DE JOGO
     ============================================================ */
  let lastFrameTime = performance.now();

  function gameLoop(now) {
    const dt = Math.min((now - lastFrameTime) / 1000, 1);
    lastFrameTime = now;

    // Renda Passiva
    const rps = getTotalRps();
    if (rps > 0) {
      state.money += rps * dt;
      state.totalEarned += rps * dt;
    }

    // Regen de Energia
    if (state.energy < state.maxEnergy) {
      state.energy = Math.min(state.maxEnergy, state.energy + dt);
    }

    updateUI();
    updateUpgradesUI();
    requestAnimationFrame(gameLoop);
  }

  /* ============================================================
     DELEGAÇÃO DE EVENTOS E INICIALIZAÇÃO
     ============================================================ */
  function setupEventListeners() {
    dom.btnPlayGame.addEventListener('click', startGame);
    dom.btnOpenCredits.addEventListener('click', openCredits);
    dom.btnCloseCredits.addEventListener('click', closeCredits);
    dom.btnBackToMenu.addEventListener('click', closeCredits);

    document.body.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const { action, id, amount } = target.dataset;

      switch (action) {
        case 'work':            doWork(e); break;
        case 'coffee':          drinkCoffee(); break;
        case 'networking':      doNetworking(); break;
        case 'upgrade-stage':   upgradeStage(); break;
        case 'buy-employee':    buyEmployee(id); break;
        case 'buy-upgrade':     buyUpgrade(id); break;
        case 'set-buy-amount':  setBuyAmount(parseInt(amount, 10)); break;
        case 'switch-tab':      switchTab(id); break;
        case 'save':            saveGame(); toast('Jogo salvo!', 'success'); break;
        case 'toggle-audio':    toggleAudio(); break;
        case 'open-reset':      dom.resetModal.classList.remove('hidden'); break;
        case 'close-reset':     dom.resetModal.classList.add('hidden'); break;
        case 'confirm-reset':   confirmReset(); break;
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !dom.screenMenu.classList.contains('hidden')) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        doWork(null);
      }
    });
  }

  function init() {
    cacheDomRefs();
    loadGame();
    buildEmployeesList();
    buildUpgradesList();
    setupEventListeners();
    updateUI();
    updateUpgradesUI();
    renderActiveEvent();

    // Loops temporizados globais
    setInterval(saveGame, AUTOSAVE_INTERVAL);

    // Sistema de checagem periódica de eventos (a cada EVENT_INTERVAL segundos)
    setInterval(() => {
      if (!activeEvent && Math.random() < EVENT_CHANCE) {
        triggerRandomEvent();
      }
    }, EVENT_INTERVAL * 1000);

    requestAnimationFrame((t) => {
      lastFrameTime = t;
      requestAnimationFrame(gameLoop);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
