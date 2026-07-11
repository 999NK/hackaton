;(function () {
  'use strict'

  var scripts = document.querySelectorAll('script[src*="widget.js"]')
  var lastScript = scripts[scripts.length - 1]
  if (!lastScript) return
  var parsedUrl = new URL(lastScript.src)
  var TOKEN = parsedUrl.searchParams.get('token')
  var API = parsedUrl.searchParams.get('api')
  if (!TOKEN || !API) return
  API = API.replace(/\/+$/, '')

  var pos = loadPos()
  var isOpen = false
  var isIdle = false
  var idleTimer = null
  var menuStack = ['main']
  var slideDir = 'right'
  var config = null
  var settings = loadSettings()
  var historyArr = []
  var voiceStatus = ''
  var voiceTranscript = ''
  var voiceMatches = []
  var screenStatus = ''
  var screenQuestion = ''
  var screenAnswer = ''
  var screenAnalysis = null
  var guidedPicking = false
  var guidedTarget = null
  var guidedStatus = ''
  var guidedPlan = []
  var ttsBusy = false
  var recognizing = false
  var recognition = null
  var overlayEl = null
  var dragData = { dragging: false, startX: 0, startY: 0, origX: 0, origY: 0, moved: false }
  var hostStyleEls = {}

  function loadPos() {
    try {
      var s = localStorage.getItem('aal-widget-position')
      if (s) return JSON.parse(s)
    } catch (e) {}
    return { x: window.innerWidth - 82, y: window.innerHeight - 82 }
  }
  function savePos() {
    try {
      localStorage.setItem('aal-widget-position', JSON.stringify(pos))
    } catch (e) {}
  }
  function loadSettings() {
    try {
      var s = localStorage.getItem('aal-widget-settings')
      if (s)
        return Object.assign(
          {
            fontSize: 100,
            highContrast: false,
            ttsSpeed: 1,
            reducedMotion: false,
            highlight: false,
            tts: false,
            colorMode: 'normal',
            controlMode: 'automatic',
            ttsLang: 'pt',
            voiceMode: false,
          },
          JSON.parse(s),
        )
    } catch (e) {}
    return {
      fontSize: 100,
      highContrast: false,
      ttsSpeed: 1,
      reducedMotion: false,
      highlight: false,
      tts: false,
      colorMode: 'normal',
      controlMode: 'automatic',
      ttsLang: 'pt',
      voiceMode: false,
    }
  }
  function saveSettings() {
    try {
      localStorage.setItem('aal-widget-settings', JSON.stringify(settings))
    } catch (e) {}
  }

  function loadPendingPlan() {
    try {
      var s = sessionStorage.getItem('aal-widget-pending-plan')
      return s ? JSON.parse(s) : []
    } catch (e) {
      return []
    }
  }
  function savePendingPlan(steps) {
    try {
      if (steps && steps.length) sessionStorage.setItem('aal-widget-pending-plan', JSON.stringify(steps))
      else sessionStorage.removeItem('aal-widget-pending-plan')
    } catch (e) {}
  }
  function loadOpenState() {
    try {
      return sessionStorage.getItem('aal-widget-open') === '1'
    } catch (e) {
      return false
    }
  }
  function saveOpenState(open) {
    try {
      if (open) sessionStorage.setItem('aal-widget-open', '1')
      else sessionStorage.removeItem('aal-widget-open')
    } catch (e) {}
  }

  function apiGet(path) {
    var sep = path.indexOf('?') > -1 ? '&' : '?'
    return fetch(API + path + sep + 'token=' + TOKEN).then(function (r) {
      return r.json()
    })
  }
  function apiPost(path, body) {
    var sep = path.indexOf('?') > -1 ? '&' : '?'
    return fetch(API + path + sep + 'token=' + TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json()
    })
  }

  var host = document.createElement('div')
  host.id = 'aal-widget-host'
  host.style.cssText =
    'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483647;pointer-events:none;overflow:visible;transform:none!important;'
  document.documentElement.appendChild(host)
  var shadow = host.attachShadow({ mode: 'closed' })

  var styleEl = document.createElement('style')
  styleEl.textContent = [
    ':host { all: initial; }',
    '* { box-sizing: border-box; margin: 0; padding: 0; }',
    '.aal-trigger { position: absolute; width: 60px; height: 60px; border-radius: 50%; background: rgba(255,255,255,0.82); backdrop-filter: blur(14px) saturate(1.4); -webkit-backdrop-filter: blur(14px) saturate(1.4); border: 2px solid rgba(37,99,235,0.25); cursor: grab; pointer-events: auto; display: flex; align-items: center; justify-content: center; transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s, box-shadow 0.25s, border-color 0.25s; box-shadow: 0 6px 24px rgba(37,99,235,0.3), 0 0 0 1px rgba(255,255,255,0.6) inset; user-select: none; -webkit-user-select: none; touch-action: none; z-index: 2; }',
    '.aal-trigger::before { content: ""; position: absolute; inset: -5px; border-radius: 50%; border: 2px solid rgba(37,99,235,0.22); animation: aal-ring 2.6s ease-out infinite; pointer-events: none; }',
    '.aal-trigger::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle at 35% 28%, rgba(255,255,255,0.75), transparent 62%); pointer-events: none; }',
    '@keyframes aal-ring { 0% { transform: scale(0.95); opacity: 0.7; } 100% { transform: scale(1.4); opacity: 0; } }',
    '.aal-trigger.idle { opacity: 0.3; }',
    '.aal-trigger.idle::before { animation: none; opacity: 0; }',
    '.aal-trigger:hover { transform: scale(1.1); box-shadow: 0 10px 36px rgba(37,99,235,0.44); border-color: rgba(37,99,235,0.5); }',
    '.aal-trigger:active { cursor: grabbing; transform: scale(0.93); }',
    '.aal-trigger img { width: 38px; height: 38px; object-fit: contain; display: block; filter: saturate(1.2) contrast(1.05); position: relative; z-index: 1; }',
    '.aal-overlay { position: absolute; inset: 0; pointer-events: auto; background: transparent; }',
    '.aal-panel { position: absolute; width: min(348px, calc(100vw - 24px)); max-height: calc(100vh - 24px); border-radius: 28px; background: rgba(255,255,255,0.82); backdrop-filter: blur(44px) saturate(1.4); -webkit-backdrop-filter: blur(44px) saturate(1.4); border: none; pointer-events: auto; box-shadow: 0 0 0 0.5px rgba(15,23,42,0.12), 0 28px 70px rgba(15,23,42,0.22), 0 8px 20px rgba(15,23,42,0.1); display: flex; flex-direction: column; overflow: hidden; transform-origin: center; animation: panelOpen 0.4s cubic-bezier(0.22,1,0.36,1); }',
    '.aal-panel.closing { animation: panelClose 0.26s ease forwards; }',
    '@keyframes panelOpen { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }',
    '@keyframes panelClose { from { transform: scale(1); opacity: 1; } to { transform: scale(0.85); opacity: 0; } }',
    '.aal-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 52px; padding: 12px 14px; background: transparent; border-bottom: 0.5px solid rgba(15,23,42,0.1); flex-shrink: 0; position: relative; }',
    '.aal-title { color: #0f172a; font-size: 15px; font-weight: 600; font-family: -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif; flex: 1; text-align: center; letter-spacing: -0.2px; }',
    '.aal-content { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 16px; background: transparent; overscroll-behavior: contain; }',
    '.aal-content::-webkit-scrollbar { width: 6px; }',
    '.aal-content::-webkit-scrollbar-track { background: transparent; }',
    '.aal-content::-webkit-scrollbar-thumb { background: rgba(37,99,235,0.22); border-radius: 3px; }',
    '.aal-content::-webkit-scrollbar-thumb:hover { background: rgba(37,99,235,0.4); }',
    '.aal-content.slide-right { animation: slideR 0.32s cubic-bezier(0.4,0,0.2,1); }',
    '.aal-content.slide-left { animation: slideL 0.32s cubic-bezier(0.4,0,0.2,1); }',
    '@keyframes slideR { from { transform: translateX(44px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }',
    '@keyframes slideL { from { transform: translateX(-44px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }',
    '.aal-ibtn { width: 30px; height: 30px; background: rgba(15,23,42,0.05); border: none; color: #0f172a; cursor: pointer; padding: 7px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.18s, transform 0.15s; flex-shrink: 0; }',
    '.aal-ibtn:hover { background: rgba(15,23,42,0.09); }',
    '.aal-ibtn:active { transform: scale(0.9); }',
    '.aal-ibtn svg { width: 17px; height: 17px; fill: currentColor; }',
    '.aal-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }',
    '.aal-gi { min-height: 84px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; padding: 12px 4px; border-radius: 18px; cursor: pointer; background: rgba(255,255,255,0.72); border: none; transition: transform 0.2s cubic-bezier(0.22,1,0.36,1), background 0.2s, box-shadow 0.2s; animation: itemIn 0.34s cubic-bezier(0.22,1,0.36,1) backwards; }',
    '.aal-gi:hover { background: rgba(255,255,255,0.96); transform: translateY(-2px); box-shadow: 0 8px 22px rgba(15,23,42,0.1); }',
    '.aal-gi:active { transform: translateY(0) scale(0.96); background: rgba(37,99,235,0.06); }',
    '@keyframes itemIn { from { transform: scale(0.85) translateY(8px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }',
    '.aal-gi-icon { width: 42px; height: 42px; border-radius: 14px; background: linear-gradient(135deg, #eff6ff, #dbeafe); display: flex; align-items: center; justify-content: center; transition: transform 0.2s, background 0.2s, box-shadow 0.2s; flex-shrink: 0; }',
    '.aal-gi:hover .aal-gi-icon { transform: scale(1.08); background: linear-gradient(135deg, #3b82f6, #2563eb); box-shadow: 0 6px 16px rgba(37,99,235,0.32); }',
    '.aal-gi-icon svg { width: 22px; height: 22px; fill: #2563eb; transition: fill 0.2s; }',
    '.aal-gi:hover .aal-gi-icon svg { fill: #ffffff; }',
    '.aal-gi span { font-size: 11px; color: #1e293b; font-weight: 500; font-family: -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif; text-align: center; letter-spacing: -0.1px; }',
    '.aal-status { padding: 8px 10px; font-size: 12px; color: #64748b; font-family: -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif; text-align: center; line-height: 1.45; }',
    '.aal-transcript { padding: 10px 14px; font-size: 14px; color: #0f172a; font-family: -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif; text-align: center; min-height: 20px; }',
    '.aal-btn { display: block; width: 100%; padding: 13px 15px; margin-bottom: 8px; border-radius: 14px; border: none; background: rgba(255,255,255,0.8); color: #0f172a; font-size: 13.5px; font-family: -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif; cursor: pointer; text-align: left; transition: transform 0.15s, background 0.18s, box-shadow 0.18s; }',
    '.aal-btn:hover { background: #ffffff; box-shadow: 0 6px 18px rgba(15,23,42,0.1); transform: translateY(-1px); }',
    '.aal-btn:active { transform: translateY(0); background: rgba(37,99,235,0.05); }',
    '.aal-btn b { font-weight: 600; }',
    '.aal-search { width: 100%; padding: 12px 15px; margin-bottom: 10px; border-radius: 14px; border: none; background: rgba(15,23,42,0.05); color: #0f172a; font-size: 14px; font-family: -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif; outline: none; transition: background 0.18s, box-shadow 0.18s; }',
    '.aal-search:focus { background: rgba(255,255,255,0.95); box-shadow: 0 0 0 4px rgba(37,99,235,0.14), 0 1px 3px rgba(15,23,42,0.08); }',
    '.aal-set { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 15px; margin-bottom: 6px; border-radius: 14px; background: rgba(255,255,255,0.78); border: none; }',
    '.aal-set label { font-size: 13px; color: #1e293b; font-family: -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif; font-weight: 500; }',
    '.aal-slider { width: 80px; accent-color: #2563eb; }',
    '.aal-select { width: 130px; padding: 8px 10px; border-radius: 10px; border: none; background: rgba(15,23,42,0.05); color: #0f172a; font-size: 12.5px; font-family: -apple-system,sans-serif; outline: none; }',
    '.aal-toggle { width: 42px; height: 25px; border-radius: 13px; background: rgba(15,23,42,0.16); border: none; cursor: pointer; position: relative; transition: background 0.25s; flex-shrink: 0; }',
    '.aal-toggle.on { background: #2563eb; }',
    '.aal-toggle::after { content: ""; position: absolute; top: 2px; left: 2px; width: 21px; height: 21px; border-radius: 50%; background: white; transition: transform 0.25s cubic-bezier(0.22,1,0.36,1); box-shadow: 0 2px 5px rgba(0,0,0,0.2); }',
    '.aal-toggle.on::after { transform: translateX(17px); }',
    '.aal-mic { display: flex; align-items: center; justify-content: center; width: 66px; height: 66px; border-radius: 50%; background: #2563eb; border: none; margin: 12px auto; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s, background 0.2s; box-shadow: 0 8px 22px rgba(37,99,235,0.36); }',
    '.aal-mic:hover { transform: scale(1.06); box-shadow: 0 12px 30px rgba(37,99,235,0.46); }',
    '.aal-mic:active { transform: scale(0.96); }',
    '.aal-mic.on { background: #ef4444; animation: aalpulse 1.4s infinite; }',
    '.aal-mic svg { width: 28px; height: 28px; fill: white; }',
    '@keyframes aalpulse { 0%,100% { box-shadow: 0 8px 22px rgba(239,68,68,0.4); } 50% { box-shadow: 0 8px 38px rgba(239,68,68,0.62); } }',
    '.aal-mb { display: block; width: 100%; padding: 12px 15px; margin-bottom: 7px; border-radius: 14px; border: none; background: rgba(37,99,235,0.07); color: #0f172a; font-size: 13.5px; font-family: -apple-system,sans-serif; cursor: pointer; text-align: left; transition: background 0.18s, transform 0.15s; }',
    '.aal-mb:hover { background: rgba(37,99,235,0.12); transform: translateY(-1px); }',
    '.aal-mt { font-size: 10.5px; color: #64748b; margin-top: 3px; }',
    '.aal-step { display: flex; align-items: center; gap: 11px; width: 100%; padding: 12px 14px; margin-bottom: 6px; border-radius: 14px; border: none; background: rgba(255,255,255,0.78); color: #0f172a; font-size: 13px; font-family: -apple-system,sans-serif; cursor: pointer; text-align: left; transition: transform 0.15s, background 0.18s; }',
    '.aal-step:hover { transform: translateY(-1px); background: #ffffff; }',
    '.aal-step-num { width: 26px; height: 26px; border-radius: 50%; background: #2563eb; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex: 0 0 26px; }',
    '.aal-step small { display: block; color: #64748b; font-size: 10.5px; margin-top: 2px; }',
    '.aal-ti { width: 100%; padding: 12px 15px; margin: 4px 0; border-radius: 14px; border: none; background: rgba(15,23,42,0.05); color: #0f172a; font-size: 14px; font-family: -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif; outline: none; transition: background 0.18s, box-shadow 0.18s; }',
    '.aal-ti:focus { background: rgba(255,255,255,0.95); box-shadow: 0 0 0 4px rgba(37,99,235,0.14); }',
    '.aal-empty { text-align: center; padding: 28px 20px; font-size: 13px; color: #64748b; font-family: -apple-system,sans-serif; }',
    '.aal-help { padding: 14px; font-size: 12.5px; color: #475569; font-family: -apple-system,sans-serif; line-height: 1.7; }',
    '.aal-help b { color: #0f172a; font-weight: 600; }',
    '.aal-section { margin-bottom: 8px; padding: 12px 13px; border-radius: 14px; background: rgba(255,255,255,0.78); border: none; color: #475569; font: 12.5px/1.55 -apple-system,sans-serif; }',
    '.aal-section b { display:block; color:#0f172a; margin-bottom:5px; font-size:12.5px; font-weight:600; }',
    '.aal-section ul { margin:0; padding-left:16px; }',
    '.aal-guide-layer { position:absolute; inset:0; pointer-events:none; z-index:3; }',
    '.aal-guide-spot { position:absolute; border:3px solid #3b82f6; border-radius:14px; box-shadow:0 0 0 9999px rgba(0,0,0,0.68), 0 0 28px rgba(59,130,246,0.8); transition:all .18s ease; }',
    '.aal-guide-card { position:absolute; max-width:260px; padding:14px; border-radius:16px; background:rgba(15,23,42,0.95); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); color:white; border:1px solid rgba(59,130,246,0.4); box-shadow:0 12px 36px rgba(0,0,0,.5); font:12px/1.5 system-ui,sans-serif; pointer-events:auto; }',
    '.aal-guide-card b { display:block; margin-bottom:6px; font-size:13px; }',
    '.aal-guide-card button { margin-top:10px; width:100%; border:0; border-radius:12px; padding:9px; background:linear-gradient(135deg, #2563eb, #1d4ed8); color:white; font-weight:700; cursor:pointer; }',
    '.aal-hist { padding: 12px 15px; font-size: 12.5px; color: #334155; font-family: -apple-system,sans-serif; border-bottom: 0.5px solid rgba(15,23,42,0.08); }',
    '.aal-hist:last-child { border-bottom: none; }',
    '.aal-hist b { color: #2563eb; font-weight: 600; }',
    '.aal-nav-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 9px; }',
    '.aal-nav-card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; padding: 18px 8px; border-radius: 18px; cursor: pointer; background: rgba(255,255,255,0.78); border: none; transition: transform 0.18s, background 0.18s, box-shadow 0.18s; }',
    '.aal-nav-card:hover { background: #ffffff; transform: translateY(-2px); box-shadow: 0 8px 22px rgba(15,23,42,0.1); }',
    '.aal-nav-card:active { transform: scale(0.97); }',
    '.aal-nav-icon { width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, #eff6ff, #dbeafe); display: flex; align-items: center; justify-content: center; transition: transform 0.2s, background 0.2s; }',
    '.aal-nav-card:hover .aal-nav-icon { transform: scale(1.08); background: linear-gradient(135deg, #3b82f6, #2563eb); }',
    '.aal-nav-icon svg { width: 22px; height: 22px; fill: #2563eb; transition: fill 0.2s; }',
    '.aal-nav-card:hover .aal-nav-icon svg { fill: #fff; }',
    '.aal-nav-card span { font-size: 12px; color: #1e293b; font-weight: 500; font-family: -apple-system,sans-serif; text-align: center; letter-spacing: -0.1px; }',
    '.aal-voice-fab { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; padding: 12px 22px 12px 14px; border-radius: 999px; background: rgba(255,255,255,0.82); backdrop-filter: blur(20px) saturate(1.4); -webkit-backdrop-filter: blur(20px) saturate(1.4); border: none; box-shadow: 0 0 0 0.5px rgba(15,23,42,0.12), 0 12px 34px rgba(15,23,42,0.2), 0 4px 12px rgba(37,99,235,0.14); cursor: pointer; z-index: 2147483646; user-select: none; -webkit-user-select: none; touch-action: none; transition: transform 0.2s cubic-bezier(0.22,1,0.36,1), box-shadow 0.2s; animation: aalFabIn 0.4s cubic-bezier(0.34,1.56,0.64,1); }',
    '@keyframes aalFabIn { from { transform: translateX(-50%) translateY(40px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }',
    '.aal-voice-fab:hover { transform: translateX(-50%) translateY(-2px); box-shadow: 0 0 0 0.5px rgba(15,23,42,0.14), 0 16px 40px rgba(15,23,42,0.24); }',
    '.aal-voice-fab:active { transform: translateX(-50%) scale(0.97); }',
    '.aal-voice-fab-mic { width: 42px; height: 42px; border-radius: 50%; background: #2563eb; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.2s; position: relative; }',
    '.aal-voice-fab-mic svg { width: 22px; height: 22px; fill: white; }',
    '.aal-voice-fab.listening .aal-voice-fab-mic { background: #ef4444; }',
    '.aal-voice-fab.listening .aal-voice-fab-mic::after { content: ""; position: absolute; inset: -6px; border-radius: 50%; border: 2px solid rgba(239,68,68,0.5); animation: aalFabPulse 1.4s ease-out infinite; }',
    '@keyframes aalFabPulse { 0% { transform: scale(0.9); opacity: 0.8; } 100% { transform: scale(1.6); opacity: 0; } }',
    '.aal-voice-fab-label { font-size: 13px; color: #0f172a; font-family: -apple-system,sans-serif; font-weight: 500; letter-spacing: -0.1px; }',
    '.aal-voice-fab-hint { font-size: 11px; color: #64748b; font-family: -apple-system,sans-serif; }',
    '@media (max-height: 520px) { .aal-header { min-height: 46px; padding: 10px 12px; } .aal-content { padding: 12px; } .aal-grid { gap: 7px; } .aal-gi { min-height: 72px; padding: 9px 3px; } .aal-gi-icon { width: 36px; height: 36px; } }',
  ].join('\n')
  shadow.appendChild(styleEl)

  var icons = {
    mic: '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z"/></svg>',
    actions:
      '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-2 14.5L5.5 10 7 8.5l3 3 6-6L16.5 7l-6.5 6.5z"/></svg>',
    shortcuts:
      '<svg viewBox="0 0 24 24"><path d="M2 6h12v2H2V6zm0 5h12v2H2v-2zm0 5h8v2H2v-2zm14-9h2v2h-2V7zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2zm4-8h2v2h-2V7zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z"/></svg>',
    highlight:
      '<svg viewBox="0 0 24 24"><path d="M9 11l-4 4v3h3l4-4m6-9l-1.5-1.5a1.5 1.5 0 00-2 0L8.5 9.5l4 4L18 8a1.5 1.5 0 000-2z"/></svg>',
    reading:
      '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4z"/></svg>',
    nav: '<svg viewBox="0 0 24 24"><path d="M12 2L4 22l8-4 8 4-8-20z"/></svg>',
    screen:
      '<svg viewBox="0 0 24 24"><path d="M12 5c5.5 0 9.5 5.2 9.5 7s-4 7-9.5 7-9.5-5.2-9.5-7S6.5 5 12 5zm0 2C8.1 7 5.1 10.2 4.6 12c.5 1.8 3.5 5 7.4 5s6.9-3.2 7.4-5C18.9 10.2 15.9 7 12 7zm0 2.2A2.8 2.8 0 1112 14.8 2.8 2.8 0 0112 9.2z"/></svg>',
    guide:
      '<svg viewBox="0 0 24 24"><path d="M11 2h2v4h-2V2zm0 16h2v4h-2v-4zM2 11h4v2H2v-2zm16 0h4v2h-4v-2zM7.05 5.64L5.64 7.05 3.5 4.91 4.91 3.5l2.14 2.14zm13.45 13.45l-1.41 1.41-2.14-2.14 1.41-1.41 2.14 2.14zM18.36 7.05l-1.41-1.41 2.14-2.14 1.41 1.41-2.14 2.14zM5.64 16.95l1.41 1.41-2.14 2.14-1.41-1.41 2.14-2.14zM12 8a4 4 0 100 8 4 4 0 000-8z"/></svg>',
    settings:
      '<svg viewBox="0 0 24 24"><path d="M19.14 12.94a7.49 7.49 0 000-1.88l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.61-.22l-2.39.96a7.03 7.03 0 00-1.62-.94l-.36-2.54a.5.5 0 00-.5-.42h-3.84a.5.5 0 00-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 00-.61.22L2.65 8.84a.5.5 0 00.12.64l2.03 1.58a7.49 7.49 0 000 1.88l-2.03 1.58a.5.5 0 00-.12.64l1.92 3.32c.14.24.42.34.68.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.26.12.54.02.68-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.03-1.58zM12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z"/></svg>',
    history:
      '<svg viewBox="0 0 24 24"><path d="M13 3a9 9 0 00-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 117 7 6.97 6.97 0 01-4.95-2.05l-1.42 1.41A8.954 8.954 0 0013 21a9 9 0 000-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>',
    help: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41a2 2 0 00-4 0H8a4 4 0 018 0c0 .88-.36 1.68-.93 2.25z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>',
    close:
      '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    user:
      '<svg viewBox="0 0 24 24"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5 0-9 2.5-9 5v3h18v-3c0-2.5-4-5-9-5z"/></svg>',
    addUser:
      '<svg viewBox="0 0 24 24"><path d="M15 12a4 4 0 100-8 4 4 0 000 8zm-8 1c0-.7.5-1.2 1.2-1.2H9a5 5 0 01-2-4 5 5 0 0110 0 5 5 0 01-2 4h.8c.7 0 1.2.5 1.2 1.2V20a1 1 0 01-1 1H8a1 1 0 01-1-1v-7zm13-1.5h-2v2h-1.5v-2H14v-1.5h2.5v-2H18v2h2v1.5z"/></svg>',
    home:
      '<svg viewBox="0 0 24 24"><path d="M12 3l9 8h-3v9h-4v-6h-4v6H6v-9H3l9-8z"/></svg>',
    info:
      '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
    search:
      '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 10-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1114 9.5 4.5 4.5 0 019.5 14z"/></svg>',
  }

  var container = document.createElement('div')
  shadow.appendChild(container)

  // Container separado para o botão flutuante de voz (não é limpo pelo render).
  var fabContainer = document.createElement('div')
  shadow.appendChild(fabContainer)

  function addHistory(action, label) {
    historyArr.unshift({
      action: action,
      label: label,
      time: new Date().toLocaleTimeString('pt-BR'),
    })
    if (historyArr.length > 20) historyArr.pop()
  }

  function showTrigger() {
    container.innerHTML = ''
    overlayEl = null
    var trigger = document.createElement('div')
    trigger.className = 'aal-trigger' + (isIdle ? ' idle' : '')
    trigger.style.left = pos.x + 'px'
    trigger.style.top = pos.y + 'px'
    trigger.innerHTML = '<img alt="" src="' + API + '/widget-icon.ico">'
    trigger.addEventListener('pointerdown', onPointerDown)
    trigger.addEventListener('pointermove', onPointerMove)
    trigger.addEventListener('pointerup', onPointerUp)
    trigger.addEventListener('pointerenter', function () {
      isIdle = false
      trigger.classList.remove('idle')
      clearTimeout(idleTimer)
    })
    container.appendChild(trigger)
    startIdleTimer()
  }

  function startIdleTimer() {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(function () {
      isIdle = true
      var t = container.querySelector('.aal-trigger')
      if (t) t.classList.add('idle')
    }, 4000)
  }

  function onPointerDown(e) {
    dragData.dragging = true
    dragData.moved = false
    dragData.startX = e.clientX
    dragData.startY = e.clientY
    dragData.origX = pos.x
    dragData.origY = pos.y
    ;(e.currentTarget || e.target).setPointerCapture(e.pointerId)
  }
  function onPointerMove(e) {
    if (!dragData.dragging) return
    var dx = e.clientX - dragData.startX
    var dy = e.clientY - dragData.startY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragData.moved = true
    pos.x = Math.max(0, Math.min(dragData.origX + dx, window.innerWidth - 60))
    pos.y = Math.max(0, Math.min(dragData.origY + dy, window.innerHeight - 60))
    var t = container.querySelector('.aal-trigger')
    if (t) {
      t.style.left = pos.x + 'px'
      t.style.top = pos.y + 'px'
    }
  }
  function onPointerUp(e) {
    ;(e.currentTarget || e.target).releasePointerCapture(e.pointerId)
    dragData.dragging = false
    if (!dragData.moved) {
      openPanel()
    } else {
      var snapX = pos.x + 30 < window.innerWidth / 2 ? 0 : window.innerWidth - 60
      pos.x = snapX
      pos.y = Math.max(0, Math.min(pos.y, window.innerHeight - 60))
      savePos()
      var t = container.querySelector('.aal-trigger')
      if (t) {
        t.style.left = pos.x + 'px'
        t.style.top = pos.y + 'px'
      }
    }
  }

  function openPanel() {
    isOpen = true
    saveOpenState(true)
    clearTimeout(idleTimer)
    render()
  }
  function closePanel() {
    var panel = container.querySelector('.aal-panel')
    if (panel) {
      panel.classList.add('closing')
      setTimeout(function () {
        isOpen = false
        saveOpenState(false)
        menuStack = ['main']
        render()
      }, 280)
    } else {
      isOpen = false
      saveOpenState(false)
      menuStack = ['main']
      render()
    }
  }

  function pushMenu(id) {
    menuStack.push(id)
    slideDir = 'right'
    renderPanel()
  }
  function popMenu() {
    if (menuStack.length > 1) {
      menuStack.pop()
      slideDir = 'left'
      renderPanel()
    }
  }

  function render() {
    if (isOpen) {
      renderPanel()
    } else {
      showTrigger()
    }
  }

  function renderPanel() {
    container.innerHTML = ''
    overlayEl = document.createElement('div')
    overlayEl.className = 'aal-overlay'
    overlayEl.addEventListener('click', closePanel)
    container.appendChild(overlayEl)

    var panel = document.createElement('div')
    panel.className = 'aal-panel'
    panel.style.visibility = 'hidden'
    container.appendChild(panel)

    var current = menuStack[menuStack.length - 1]
    var titleMap = {
      main: config && config.project ? config.project.name : 'AccessLayer',
      voice: 'Voz',
      actions: 'Ações',
      shortcuts: 'Atalhos',
      highlight: 'Destaque',
      guide: 'Guiado',
      reading: 'Leitura',
      screen: 'Tela',
      nav: 'Navegação',
      settings: 'Configurações',
      history: 'Histórico',
      help: 'Ajuda',
    }

    var header = document.createElement('div')
    header.className = 'aal-header'
    if (menuStack.length > 1) {
      var backBtn = document.createElement('button')
      backBtn.className = 'aal-ibtn'
      backBtn.innerHTML = icons.back
      backBtn.addEventListener('click', popMenu)
      header.appendChild(backBtn)
    } else {
      var spacer = document.createElement('div')
      spacer.style.width = '24px'
      header.appendChild(spacer)
    }
    var title = document.createElement('div')
    title.className = 'aal-title'
    title.textContent = titleMap[current] || 'AccessLayer'
    header.appendChild(title)
    var closeBtn = document.createElement('button')
    closeBtn.className = 'aal-ibtn'
    closeBtn.innerHTML = icons.close
    closeBtn.addEventListener('click', closePanel)
    header.appendChild(closeBtn)
    panel.appendChild(header)

    var content = document.createElement('div')
    content.className = 'aal-content' + (slideDir === 'right' ? ' slide-right' : ' slide-left')
    panel.appendChild(content)

    switch (current) {
      case 'main':
        renderMain(content)
        break
      case 'voice':
        renderVoice(content)
        break
      case 'actions':
        renderActions(content)
        break
      case 'shortcuts':
        renderShortcuts(content)
        break
      case 'highlight':
        renderHighlight(content)
        break
      case 'guide':
        renderGuided(content)
        break
      case 'reading':
        renderReading(content)
        break
      case 'nav':
        renderNav(content)
        break
      case 'screen':
        renderScreen(content)
        break
      case 'settings':
        renderSettings(content)
        break
      case 'history':
        renderHistory(content)
        break
      case 'help':
        renderHelp(content)
        break
    }

    positionPanel(panel)
    requestAnimationFrame(function () {
      if (panel.isConnected) positionPanel(panel)
    })
    if (window.ResizeObserver) {
      var panelObserver = new ResizeObserver(function () {
        if (panel.isConnected) positionPanel(panel)
        else panelObserver.disconnect()
      })
      panelObserver.observe(panel)
    }
  }

  function positionPanel(panel) {
    var viewport = window.visualViewport
    var viewportLeft = viewport ? viewport.offsetLeft : 0
    var viewportTop = viewport ? viewport.offsetTop : 0
    var viewportWidth = viewport ? viewport.width : window.innerWidth
    var viewportHeight = viewport ? viewport.height : window.innerHeight
    var margin = 12
    // Limita o painel à área visível da viewport.
    var availW = Math.max(0, viewportWidth - margin * 2)
    var availH = Math.max(0, viewportHeight - margin * 2)
    panel.style.maxWidth = availW + 'px'
    panel.style.maxHeight = availH + 'px'

    var pw = panel.offsetWidth
    var ph = panel.offsetHeight
    // Se o painel (em sua altura natural) for maior que a área disponível,
    // ele já está limitado pelo max-height, então usamos a altura disponível.
    var effectiveH = Math.min(ph, availH)

    var triggerOnLeft = pos.x + 30 < window.innerWidth / 2

    // Posição X: ancora à lateral do botão, mas sempre dentro da viewport.
    var left
    if (triggerOnLeft) {
      left = viewportLeft + margin
    } else {
      left = viewportLeft + viewportWidth - pw - margin
    }
    left = Math.max(viewportLeft + margin, Math.min(left, viewportLeft + viewportWidth - pw - margin))
    panel.style.left = left + 'px'
    panel.style.right = 'auto'

    // Posição Y: tenta alinhar ao botão, mas GARANTE que apareça inteiro.
    var preferredY = pos.y + 30 < window.innerHeight / 2 ? pos.y : pos.y + 60 - effectiveH
    var minY = viewportTop + margin
    var maxY = viewportTop + viewportHeight - effectiveH - margin
    // Se não couber verticalmente (maxY < minY), centraliza na viewport.
    if (maxY < minY) {
      panel.style.top = viewportTop + margin + 'px'
    } else {
      panel.style.top = Math.max(minY, Math.min(preferredY, maxY)) + 'px'
    }
    panel.style.visibility = 'visible'
  }

  function renderMain(c) {
    var items = [
      { id: 'voice', icon: icons.mic, label: 'Voz' },
      { id: 'actions', icon: icons.actions, label: 'Ações' },
      { id: 'shortcuts', icon: icons.shortcuts, label: 'Atalhos' },
      { id: 'highlight', icon: icons.highlight, label: 'Destaque' },
      { id: 'guide', icon: icons.guide, label: 'Guiado' },
      { id: 'reading', icon: icons.reading, label: 'Leitura' },
      { id: 'nav', icon: icons.nav, label: 'Navegar' },
      { id: 'screen', icon: icons.screen, label: 'Tela' },
      { id: 'settings', icon: icons.settings, label: 'Config' },
      { id: 'history', icon: icons.history, label: 'Histórico' },
      { id: 'help', icon: icons.help, label: 'Ajuda' },
    ]
    var grid = document.createElement('div')
    grid.className = 'aal-grid'
    items.forEach(function (item, index) {
      var gi = document.createElement('div')
      gi.className = 'aal-gi'
      gi.style.animationDelay = index * 0.028 + 's'
      gi.innerHTML =
        '<div class="aal-gi-icon">' +
        item.icon +
        '</div><span>' +
        item.label +
        '</span>'
      gi.addEventListener('click', function () {
        pushMenu(item.id)
      })
      grid.appendChild(gi)
    })
    c.appendChild(grid)
  }

  function renderVoice(c) {
    // Toggle do modo de voz (liga o botão flutuante de voz).
    var modeRow = document.createElement('div')
    modeRow.className = 'aal-set'
    var modeLab = document.createElement('label')
    modeLab.textContent = 'Modo de voz (botão flutuante)'
    modeRow.appendChild(modeLab)
    var modeTg = document.createElement('button')
    modeTg.className = 'aal-toggle' + (settings.voiceMode ? ' on' : '')
    modeTg.addEventListener('click', function () {
      settings.voiceMode = !settings.voiceMode
      saveSettings()
      applyVoiceMode()
      modeTg.classList.toggle('on')
    })
    modeRow.appendChild(modeTg)
    c.appendChild(modeRow)

    var statusDiv = document.createElement('div')
    statusDiv.className = 'aal-status'
    statusDiv.textContent = voiceStatus || 'Toque no microfone para falar'
    c.appendChild(statusDiv)

    var micBtn = document.createElement('div')
    micBtn.className = 'aal-mic' + (recognizing ? ' on' : '')
    micBtn.innerHTML = icons.mic
    micBtn.addEventListener('click', function () {
      if (recognizing) {
        stopListening()
      } else {
        startListening()
      }
    })
    c.appendChild(micBtn)

    var transcriptDiv = document.createElement('div')
    transcriptDiv.className = 'aal-transcript'
    transcriptDiv.textContent = voiceTranscript || ''
    c.appendChild(transcriptDiv)

    var SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      var label = document.createElement('div')
      label.className = 'aal-status'
      label.textContent = 'Reconhecimento de voz não disponível. Use texto:'
      c.appendChild(label)
      var input = document.createElement('input')
      input.className = 'aal-ti'
      input.placeholder = 'Digite seu comando...'
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && input.value.trim()) {
          voiceTranscript = input.value.trim()
          processCommand(voiceTranscript)
        }
      })
      c.appendChild(input)
    }

    if (voiceMatches.length > 0) {
      voiceMatches.forEach(function (m) {
        var btn = document.createElement('button')
        btn.className = 'aal-mb'
        btn.innerHTML = m.name + '<div class="aal-mt">' + m.type + '</div>'
        btn.addEventListener('click', function () {
          executeCommand(m)
        })
        c.appendChild(btn)
      })
    }

    if (guidedPlan.length > 0) {
      guidedPlan.slice(0, 4).forEach(function (step, index) {
        var row = document.createElement('div')
        row.className = 'aal-step'
        var label = step.label || (step.match && step.match.name) || step.reason || 'Passo'
        row.innerHTML =
          '<span class="aal-step-num">' +
          (index + 1) +
          '</span><span><b>' +
          escapeHtml(label) +
          '</b><small>' +
          (index === 0 ? 'Agora' : 'Depois') +
          '</small></span>'
        c.appendChild(row)
      })
    }
  }

  // ---- Modo de voz: botão flutuante (FAB) centro-inferior ----
  var voiceFabEl = null
  var fabHoldTimer = null
  var fabPointerActive = false

  function isTouchDevice() {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    )
  }

  function applyVoiceMode() {
    if (settings.voiceMode) createVoiceFab()
    else removeVoiceFab()
  }

  function removeVoiceFab() {
    if (voiceFabEl) {
      voiceFabEl.remove()
      voiceFabEl = null
    }
    if (recognizing) {
      try {
        if (recognition) recognition.stop()
      } catch (e) {}
      recognizing = false
    }
  }

  function updateVoiceFabState() {
    if (!voiceFabEl) return
    var micWrap = voiceFabEl.querySelector('.aal-voice-fab-mic')
    var hint = voiceFabEl.querySelector('.aal-voice-fab-hint')
    if (recognizing) {
      voiceFabEl.classList.add('listening')
      if (micWrap) micWrap.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'
      if (hint) hint.textContent = isTouchDevice() ? 'Solte para enviar' : 'Toque para parar'
    } else {
      voiceFabEl.classList.remove('listening')
      if (micWrap) micWrap.innerHTML = icons.mic
      if (hint) hint.textContent = isTouchDevice() ? 'Segure para falar' : 'Toque para falar'
    }
  }

  function createVoiceFab() {
    if (voiceFabEl) return
    var touch = isTouchDevice()
    var fab = document.createElement('div')
    fab.className = 'aal-voice-fab'
    fab.setAttribute('role', 'button')
    fab.setAttribute('aria-label', 'Falar para navegar')
    fab.innerHTML =
      '<div class="aal-voice-fab-mic">' +
      icons.mic +
      '</div><div style="display:flex;flex-direction:column;line-height:1.2"><span class="aal-voice-fab-label">Navegar por voz</span><span class="aal-voice-fab-hint">' +
      (touch ? 'Segure para falar' : 'Toque para falar') +
      '</span></div>'
    fabContainer.appendChild(fab)
    voiceFabEl = fab

    var holdHandled = false
    fab.addEventListener('pointerdown', function (e) {
      if (!touch) return // no PC, espera o click
      e.preventDefault()
      fabPointerActive = true
      holdHandled = false
      fab.setPointerCapture(e.pointerId)
      if (!recognizing) startListening()
      updateVoiceFabState()
    })
    fab.addEventListener('pointerup', function (e) {
      if (!touch || !fabPointerActive) return
      fabPointerActive = false
      try {
        fab.releasePointerCapture(e.pointerId)
      } catch (err) {}
      if (recognizing) stopListening()
      updateVoiceFabState()
    })
    fab.addEventListener('pointercancel', function () {
      fabPointerActive = false
      if (recognizing) stopListening()
      updateVoiceFabState()
    })
    // PC: click alterna listening.
    fab.addEventListener('click', function (e) {
      if (touch) return // no mobile o pointerdown/up cuida
      e.preventDefault()
      e.stopPropagation()
      if (recognizing) {
        stopListening()
      } else {
        startListening()
      }
      updateVoiceFabState()
    })
    updateVoiceFabState()
  }

  function startListening() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      voiceStatus = 'Voz não suportada neste navegador'
      renderPanel()
      return
    }
    recognition = new SR()
    recognition.lang = settings.ttsLang === 'en' ? 'en-US' : 'pt-BR'
    recognition.continuous = false
    recognition.interimResults = true
    recognizing = true
    voiceStatus = 'Ouvindo...'
    voiceTranscript = ''
    voiceMatches = []
    renderPanel()
    updateVoiceFabState()

    recognition.onresult = function (event) {
      var txt = ''
      for (var i = 0; i < event.results.length; i++) {
        txt += event.results[i][0].transcript
      }
      voiceTranscript = txt
      var td = container.querySelector('.aal-transcript')
      if (td) td.textContent = txt
    }
    recognition.onerror = function () {
      recognizing = false
      voiceStatus = 'Erro no reconhecimento'
      renderPanel()
      updateVoiceFabState()
    }
    recognition.onend = function () {
      recognizing = false
      if (voiceTranscript.trim()) {
        voiceStatus = 'Processando...'
        renderPanel()
        updateVoiceFabState()
        processCommand(voiceTranscript.trim())
      } else {
        voiceStatus = 'Nada foi dito'
        renderPanel()
        updateVoiceFabState()
      }
    }
    recognition.start()
  }
  function stopListening() {
    if (recognition) recognition.stop()
    recognizing = false
    renderPanel()
    updateVoiceFabState()
  }

  function processCommand(transcript) {
    if (/^(continuar|continue|prosseguir|pode continuar)$/i.test(transcript.trim())) {
      var pending = loadPendingPlan()
      if (pending.length) {
        executePlan(pending)
        return
      }
    }
    apiPost('/backend/v1/widget/command', {
      transcript: transcript,
      path: window.location.pathname,
      url: window.location.href,
    })
      .then(function (data) {
        if (data.error) {
          voiceStatus = 'Erro: ' + data.error
          voiceMatches = []
          renderPanel()
          return
        }
        var matches = data.matches || []
        if (matches.length === 0) {
          voiceStatus = 'Nenhuma ação encontrada'
          renderPanel()
        } else {
          // Navegação direta, sem pedir confirmação.
          // Sempre age sobre o melhor match (maior confiança).
          var best = matches.slice().sort(function (a, b) {
            return (b.confidence || 0) - (a.confidence || 0)
          })[0]
          if (data.steps && data.steps.length) {
            if (settings.controlMode === 'guided') {
              showGuidedPlan(data.steps, best)
            } else {
              executePlan(data.steps)
            }
          } else if (data.action === 'NAVIGATE') {
            // Sem passos mapeados, tenta executar a navegação direto.
            executeCommand(best, data.action, data.fillValue)
          } else {
            executeCommand(best, data.action, data.fillValue)
          }
        }
      })
      .catch(function () {
        voiceStatus = 'Erro de conexão'
        renderPanel()
      })
  }

  function requiredFieldsMissing() {
    return Array.prototype.slice
      .call(document.querySelectorAll('input[required], textarea[required], select[required]'))
      .filter(function (el) {
        if (el.disabled || el.type === 'hidden') return false
        if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return true
        return !String(el.value || '').trim()
      })
  }

  function executePlan(steps) {
    steps = steps || []
    savePendingPlan([])
    guidedPlan = steps.slice()
    if (!steps.length) {
      voiceStatus = 'Plano concluido'
      renderPanel()
      return
    }

    var missing = requiredFieldsMissing()
    if (missing.length) {
      savePendingPlan(steps)
      if (missing[0].focus) missing[0].focus()
      voiceStatus = 'Preencha os campos obrigatorios e diga "continuar".'
      voiceMatches = []
      renderPanel()
      return
    }

    var step = steps.shift()
    if (!step) return executePlan(steps)
    var match = step.match || {}
    if (step.action === 'BLOCKED') {
      savePendingPlan([])
      voiceStatus = step.reason || 'Nao encontrei caminho clicavel para essa navegacao.'
      voiceMatches = []
      renderPanel()
      return
    }
    if (step.action === 'DONE') {
      savePendingPlan([])
      voiceStatus = step.reason || 'Voce ja esta nessa tela.'
      voiceMatches = []
      renderPanel()
      return
    }
    if (step.action === 'WAIT_INPUT') {
      var inputEl = findElementForMatch(match)
      savePendingPlan(steps)
      if (inputEl) {
        try {
          inputEl.scrollIntoView({ block: 'center', inline: 'center', behavior: settings.reducedMotion ? 'auto' : 'smooth' })
        } catch (e) {}
        if (inputEl.focus) inputEl.focus()
        showGuidedSpotlight(inputEl)
      }
      voiceStatus = step.reason || 'Preencha o campo destacado e diga "continuar".'
      voiceMatches = []
      renderPanel()
      if (inputEl) showGuidedSpotlight(inputEl)
      return
    }
    if (step.action === 'CLICK') {
      var el = findElementForMatch(match)
      if (el) {
        savePendingPlan(steps)
        activateElement(el)
        addHistory('CLICK', step.label || match.name || 'Acao')
        voiceStatus = 'Executando: ' + (step.label || match.name || 'acao') + (steps.length ? ' | Proximo passo preparado.' : '')
        renderPanel()
        setTimeout(function () {
          executePlan(loadPendingPlan())
        }, 700)
        return
      }
      savePendingPlan([])
      voiceStatus = 'Nao encontrei o botao/link "' + (step.label || match.name || '') + '" na tela atual.'
      voiceMatches = []
      renderPanel()
      return
    }
    executePlan(steps)
  }

  function resumePendingPlanSoon() {
    var pending = loadPendingPlan()
    if (!pending.length) return
    setTimeout(function () {
      if (!isOpen) openPanel()
      menuStack = ['main', 'voice']
      voiceStatus = 'Continuando navegacao...'
      renderPanel()
      executePlan(loadPendingPlan())
    }, 800)
  }

  function setNativeValue(el, value) {
    var proto = Object.getPrototypeOf(el)
    var descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
    if (descriptor && descriptor.set) descriptor.set.call(el, value)
    else el.value = value
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function escapeCss(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value)
    return String(value).replace(/["\\]/g, '\\$&')
  }

  function visibleText(el) {
    return String(
      (el && (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.textContent)) || '',
    )
      .replace(/\s+/g, ' ')
      .trim()
  }

  function isVisibleAction(el) {
    if (!el || !el.getBoundingClientRect) return false
    if (el.closest && el.closest('#aal-widget-host')) return false
    if (el.disabled || el.getAttribute('aria-hidden') === 'true') return false
    var style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
    var rect = el.getBoundingClientRect()
    return rect.width > 8 && rect.height > 8 && rect.bottom >= 0 && rect.right >= 0 && rect.top <= window.innerHeight && rect.left <= window.innerWidth
  }

  function selectorForElement(el, index) {
    if (!el || !el.tagName) return ''
    if (el.id) return '#' + escapeCss(el.id)
    var anchor = el.getAttribute('data-skip-anchor')
    if (anchor) return '[data-skip-anchor="' + escapeCss(anchor) + '"]'
    var aria = el.getAttribute('aria-label')
    if (aria) return el.tagName.toLowerCase() + '[aria-label="' + escapeCss(aria) + '"]'
    var name = el.getAttribute('name')
    if (name) return el.tagName.toLowerCase() + '[name="' + escapeCss(name) + '"]'
    var href = el.getAttribute('href')
    if (href && href.indexOf('javascript:') !== 0) return 'a[href="' + escapeCss(href) + '"]'
    return '[data-aal-live-action="' + index + '"]'
  }

  function collectCurrentPageActions() {
    var selectors = [
      'button',
      'a[href]',
      'input:not([type="hidden"])',
      'textarea',
      'select',
      '[role="button"]',
      '[role="link"]',
      '[aria-label]',
      '[data-skip-anchor]',
    ].join(',')
    var nodes = Array.prototype.slice.call(document.querySelectorAll(selectors))
    var seen = new Set()
    var actions = []
    nodes.forEach(function (node) {
      var el = meaningfulTarget(node)
      if (!isVisibleAction(el) || seen.has(el)) return
      seen.add(el)
      var tag = (el.tagName || '').toLowerCase()
      var label = elementLabel(el)
      if (!label && tag === 'input') label = el.getAttribute('type') === 'password' ? 'Senha' : 'Campo'
      if (!label) return
      var index = actions.length + 1
      var selector = selectorForElement(el, index)
      if (selector.indexOf('data-aal-live-action') > -1) el.setAttribute('data-aal-live-action', index)
      var isField = /^(input|textarea|select)$/.test(tag)
      var href = el.getAttribute('href') || ''
      actions.push({
        id: 'live-' + index,
        type: 'COMPONENT',
        name: label.slice(0, 80),
        description: isField ? 'Campo visivel nesta tela.' : 'Acao visivel nesta tela.',
        path: window.location.pathname,
        metadata: {
          cssSelector: selector,
          label: label,
          kind: isField ? 'fill' : href ? 'navigation' : 'click',
          targetRoute: href && href.charAt(0) === '/' ? href : '',
          componentType: tag,
          live: true,
        },
      })
    })
    return actions.slice(0, 12)
  }

  function findByText(label) {
    label = String(label || '').toLowerCase().trim()
    if (!label) return null
    var candidates = document.querySelectorAll('button,a,[role="button"],input,textarea,select,[aria-label]')
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i]
      if (el.closest && el.closest('#aal-widget-host')) continue
      var text = visibleText(el).toLowerCase()
      var placeholder = String(el.getAttribute('placeholder') || '').toLowerCase()
      var value = String(el.value || '').toLowerCase()
      if (text === label || text.indexOf(label) > -1 || placeholder.indexOf(label) > -1 || value === label) return el
    }
    return null
  }

  function findElementForMatch(match) {
    var meta = match && match.metadata ? match.metadata : {}
    var selectors = []
    if (meta.cssSelector) selectors.push(meta.cssSelector)
    if (meta.anchorId) selectors.push('#' + escapeCss(meta.anchorId), '[data-skip-anchor="' + escapeCss(meta.anchorId) + '"]')
    if (meta.inputName) selectors.push('[name="' + escapeCss(meta.inputName) + '"]')
    if (meta.targetRoute) selectors.push('a[href="' + escapeCss(meta.targetRoute) + '"]')
    for (var i = 0; i < selectors.length; i++) {
      try {
        var found = document.querySelector(selectors[i])
        if (found && !(found.closest && found.closest('#aal-widget-host'))) return found
      } catch (e) {}
    }
    return findByText(meta.label || (match && match.name) || '')
  }

  function activateElement(el) {
    if (!el) return false
    var target = el.closest ? el.closest('button,a,[role="button"],label,input,textarea,select,[tabindex]') || el : el
    try {
      target.scrollIntoView({ block: 'center', inline: 'center', behavior: settings.reducedMotion ? 'auto' : 'smooth' })
    } catch (e) {}
    if (target.focus) target.focus({ preventScroll: true })
    ;['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (type) {
      try {
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
      } catch (e) {}
    })
    if (target.click) target.click()
    return true
  }

  function executeCommand(match, action, fillValue) {
    if (!action) action = 'NAVIGATE'
    if (match && match._action) action = match._action
    if (match && match._fillValue) fillValue = match._fillValue
    var targetRoute = match.metadata ? match.metadata.targetRoute : ''
    if (action === 'NAVIGATE' && (targetRoute || match.path)) {
      var navEl = findElementForMatch(match)
      if (navEl) {
        activateElement(navEl)
        addHistory('NAVIGATE', match.name)
        voiceStatus = 'Executando caminho: ' + match.name
      } else {
        voiceStatus = 'Nao encontrei um link ou botao clicavel para ' + match.name
      }
      voiceMatches = []
      renderPanel()
      return
      voiceStatus = '✓ Navegando para ' + match.name
    } else if (action === 'CLICK') {
      var el = findElementForMatch(match)
      if (!el && targetRoute) {
        voiceStatus = 'Nao encontrei o link ou botao para ' + match.name
        voiceMatches = []
        renderPanel()
        return
      }
      if (el) {
        if (!el && targetRoute) {
          voiceStatus = 'Nao encontrei o link ou botao para ' + match.name
          return
          voiceStatus = 'âœ“ Navegando para ' + match.name
        }
        if (el) {
          activateElement(el)
          addHistory('CLICK', match.name)
          voiceStatus = '✓ Ação executada: ' + match.name
        } else {
          voiceStatus = 'Elemento não encontrado'
        }
      } else {
        voiceStatus = 'Seletor não disponível'
      }
    } else if (action === 'FILL') {
      var el2 = findElementForMatch(match)
      if (el2) {
        if (el2) {
          if (!fillValue) {
            if (el2.focus) el2.focus()
            voiceStatus = 'Campo focado. Diga o valor para preencher.'
            voiceMatches = []
            renderPanel()
            return
          }
          setNativeValue(el2, fillValue || '')
          addHistory('FILL', match.name + ' = ' + (fillValue || ''))
          voiceStatus = '✓ Campo preenchido: ' + match.name
        } else {
          voiceStatus = 'Elemento não encontrado'
        }
      } else {
        voiceStatus = 'Seletor não disponível'
      }
    }
    voiceMatches = []
    renderPanel()
  }

  function renderActions(c) {
    var liveActions = collectCurrentPageActions()
    if (liveActions.length) {
      var currentInfo = document.createElement('div')
      currentInfo.className = 'aal-status'
      currentInfo.textContent = 'Acoes visiveis nesta tela agora'
      c.appendChild(currentInfo)
      liveActions.forEach(function (ent) {
        var btn = document.createElement('button')
        btn.className = 'aal-btn'
        var isField = ent.metadata && ent.metadata.kind === 'fill'
        btn.innerHTML =
          '<b>' +
          escapeHtml(ent.name) +
          '</b><br><span style="font-size:11px;opacity:0.68">' +
          (isField ? 'Campo da tela atual' : 'Botao ou link da tela atual') +
          '</span>'
        btn.addEventListener('click', function () {
          var targetRoute = ent.metadata ? ent.metadata.targetRoute : ''
          executeCommand(ent, isField ? 'FILL' : targetRoute ? 'NAVIGATE' : 'CLICK')
        })
        c.appendChild(btn)
      })
      return
    }

    var loading = document.createElement('div')
    loading.className = 'aal-status'
    loading.textContent = 'Carregando ações...'
    c.appendChild(loading)
    apiGet('/backend/v1/widget/entities?path=' + encodeURIComponent(window.location.pathname))
      .then(function (data) {
        c.innerHTML = ''
        var entities = data.entities || []
        if (entities.length === 0) {
          c.innerHTML = '<div class="aal-empty">Nenhuma ação disponível para esta rota.</div>'
          return
        }
        entities.forEach(function (ent) {
          var btn = document.createElement('button')
          btn.className = 'aal-btn'
          btn.innerHTML =
            '<b>' +
            ent.name +
            '</b>' +
            (ent.description
              ? '<br><span style="font-size:11px;opacity:0.6">' + ent.description + '</span>'
              : '')
          btn.addEventListener('click', function () {
            var targetRoute = ent.metadata ? ent.metadata.targetRoute : ''
            executeCommand(ent, targetRoute ? 'NAVIGATE' : 'CLICK')
          })
          c.appendChild(btn)
        })
      })
      .catch(function () {
        c.innerHTML = '<div class="aal-empty">Erro ao carregar ações.</div>'
      })
  }

  function routeIcon(name) {
    var n = String(name || '').toLowerCase()
    if (/(login|entrar|acessar|sign in|log in)/.test(n)) return icons.user
    if (/(cadastro|register|sign up|criar conta)/.test(n)) return icons.addUser
    if (/(config|ajustes|setting|preferenc)/.test(n)) return icons.settings
    if (/(perfil|profile|conta|account)/.test(n)) return icons.user
    if (/(home|inicio|dashboard|painel)/.test(n)) return icons.home
    if (/(ajuda|help|suporte|support)/.test(n)) return icons.help
    if (/(sobre|about)/.test(n)) return icons.info
    if (/(busca|search|pesquisa)/.test(n)) return icons.search
    return icons.nav
  }

  function renderNav(c) {
    var grid = document.createElement('div')
    grid.className = 'aal-nav-grid'
    c.appendChild(grid)
    var loading = document.createElement('div')
    loading.className = 'aal-status'
    loading.style.gridColumn = '1 / -1'
    loading.textContent = 'Carregando telas...'
    grid.appendChild(loading)

    apiGet('/backend/v1/widget/sitemap')
      .then(function (data) {
        var routes = data.routes || []
        grid.innerHTML = ''
        if (routes.length === 0) {
          grid.style.display = 'block'
          grid.innerHTML = '<div class="aal-empty">Nenhuma tela disponível.</div>'
          return
        }
        routes.slice(0, 24).forEach(function (r) {
          var label = r.pageTitle || r.name || 'Tela'
          var card = document.createElement('div')
          card.className = 'aal-nav-card'
          card.innerHTML =
            '<div class="aal-nav-icon">' +
            routeIcon(label) +
            '</div><span>' +
            escapeHtml(label) +
            '</span>'
          card.addEventListener('click', function () {
            addHistory('NAVIGATE', label)
            processCommand('ir para ' + label)
          })
          grid.appendChild(card)
        })
      })
      .catch(function () {
        grid.style.display = 'block'
        grid.innerHTML = '<div class="aal-empty">Erro ao carregar telas.</div>'
      })
  }

  function collectDomText() {
    var parts = []
    var title = document.title || ''
    if (title) parts.push('Titulo: ' + title)
    parts.push('URL: ' + window.location.href)
    var h1 = document.querySelector('h1')
    if (h1) parts.push('Cabecalho: ' + (h1.innerText || '').replace(/\s+/g, ' ').trim())
    Array.prototype.slice
      .call(
        document.querySelectorAll(
          'h1,h2,h3,h4,p,li,label,button,a,input,textarea,select,[aria-label],img[alt],[role]',
        ),
      )
      .slice(0, 400)
      .forEach(function (el) {
        if (el.closest && el.closest('#aal-widget-host')) return
        var text =
          el.getAttribute('aria-label') ||
          el.getAttribute('alt') ||
          el.getAttribute('placeholder') ||
          el.getAttribute('title') ||
          el.value ||
          el.innerText ||
          el.textContent ||
          ''
        text = String(text).replace(/\s+/g, ' ').trim()
        if (text && text.length < 400) parts.push(el.tagName.toLowerCase() + ': ' + text)
      })
    return parts.join('\n').slice(0, 14000)
  }

  function captureScreenFrame() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      return Promise.resolve('')
    }
    return navigator.mediaDevices
      .getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false })
      .then(function (stream) {
        return new Promise(function (resolve, reject) {
          var video = document.createElement('video')
          video.muted = true
          video.srcObject = stream
          video.onloadedmetadata = function () {
            video.play()
            setTimeout(function () {
              try {
                var maxWidth = 1280
                var scale = Math.min(1, maxWidth / video.videoWidth)
                var canvas = document.createElement('canvas')
                canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
                canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
                var ctx = canvas.getContext('2d')
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
                stream.getTracks().forEach(function (track) {
                  track.stop()
                })
                resolve(canvas.toDataURL('image/jpeg', 0.72))
              } catch (error) {
                stream.getTracks().forEach(function (track) {
                  track.stop()
                })
                reject(error)
              }
            }, 300)
          }
        })
      })
  }

  function analyzeScreen(question) {
    screenStatus = 'Capturando tela...'
    screenAnswer = ''
    screenAnalysis = null
    renderPanel()
    captureScreenFrame()
      .then(function (image) {
        screenStatus = 'Analisando com IA...'
        renderPanel()
        return apiPost('/backend/v1/widget/screen', {
          image: image,
          question: question || '',
          path: window.location.pathname,
          url: window.location.href,
          domText: collectDomText(),
        })
      })
      .then(function (data) {
        if (data.error) {
          screenStatus = 'Erro: ' + data.error
          screenAnswer = ''
          screenAnalysis = null
        } else {
          screenStatus = 'Analise concluida'
          screenAnalysis = data.analysis || null
          screenAnswer = data.answer || ''
        }
        renderPanel()
      })
      .catch(function () {
        screenStatus = 'Nao consegui capturar a tela. Use permissao da aba ou tente novamente.'
        renderPanel()
      })
  }

  function appendScreenSection(c, title, value) {
    if (!value || (Array.isArray(value) && value.length === 0)) return
    var box = document.createElement('div')
    box.className = 'aal-section'
    function esc(v) {
      return String(v).replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
      })
    }
    var html = '<b>' + esc(title) + '</b>'
    if (Array.isArray(value)) {
      html += '<ul>' + value.slice(0, 4).map(function (item) { return '<li>' + esc(item) + '</li>' }).join('') + '</ul>'
    } else {
      html += '<span>' + esc(value) + '</span>'
    }
    box.innerHTML = html
    c.appendChild(box)
  }

  function renderScreen(c) {
    var info = document.createElement('div')
    info.className = 'aal-status'
    info.textContent =
      screenStatus || 'Capture a aba atual para perguntar, explicar ou descrever a tela com IA.'
    c.appendChild(info)

    var input = document.createElement('input')
    input.className = 'aal-ti'
    input.placeholder = 'Pergunta opcional sobre a tela...'
    input.value = screenQuestion
    input.addEventListener('input', function () {
      screenQuestion = input.value
    })
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') analyzeScreen(screenQuestion)
    })
    c.appendChild(input)

    var btn = document.createElement('button')
    btn.className = 'aal-btn'
    btn.innerHTML = '<b>Analisar tela</b><br><span style="font-size:11px;opacity:0.6">Usa print autorizado + dados salvos</span>'
    btn.addEventListener('click', function () {
      analyzeScreen(screenQuestion)
    })
    c.appendChild(btn)

    if (screenAnalysis) {
      appendScreenSection(c, 'Resumo', screenAnalysis.summary)
      appendScreenSection(c, 'Resposta', screenAnalysis.answer)
      appendScreenSection(c, 'Textos visiveis', screenAnalysis.visibleText)
      appendScreenSection(c, 'Campos', screenAnalysis.fields)
      appendScreenSection(c, 'Acoes', screenAnalysis.actions)
      appendScreenSection(c, 'Perguntas possiveis', screenAnalysis.possibleQuestions)
      appendScreenSection(c, 'Avisos', screenAnalysis.warnings)
    } else if (screenAnswer) {
      var answer = document.createElement('div')
      answer.className = 'aal-help'
      answer.textContent = screenAnswer
      c.appendChild(answer)
    }
  }

  function renderSettings(c) {
    var items = [
      {
        key: 'controlMode',
        label: 'Modo',
        type: 'select',
        options: [
          ['automatic', 'Automatico'],
          ['guided', 'Guiado'],
        ],
      },
      {
        key: 'fontSize',
        label: 'Tamanho da Fonte',
        type: 'slider',
        min: 50,
        max: 200,
        step: 10,
        unit: '%',
      },
      { key: 'highContrast', label: 'Alto Contraste', type: 'toggle' },
      {
        key: 'colorMode',
        label: 'Modo de cores',
        type: 'select',
        options: [
          ['normal', 'Padrao'],
          ['protanopia', 'Protanopia'],
          ['deuteranopia', 'Deuteranopia'],
          ['tritanopia', 'Tritanopia'],
          ['achromatopsia', 'Acromatopsia'],
        ],
      },
      {
        key: 'ttsSpeed',
        label: 'Velocidade TTS',
        type: 'slider',
        min: 0.5,
        max: 2,
        step: 0.1,
        unit: 'x',
      },
      {
        key: 'ttsLang',
        label: 'Idioma do TTS',
        type: 'select',
        options: [
          ['pt', 'Português'],
          ['en', 'Inglês'],
        ],
      },
      { key: 'reducedMotion', label: 'Movimento Reduzido', type: 'toggle' },
    ]
    items.forEach(function (item) {
      var row = document.createElement('div')
      row.className = 'aal-set'
      var lab = document.createElement('label')
      lab.textContent = item.label
      row.appendChild(lab)
      if (item.type === 'toggle') {
        var tg = document.createElement('button')
        tg.className = 'aal-toggle' + (settings[item.key] ? ' on' : '')
        tg.addEventListener('click', function () {
          settings[item.key] = !settings[item.key]
          saveSettings()
          applySettings()
          tg.classList.toggle('on')
        })
        row.appendChild(tg)
      } else if (item.type === 'slider') {
        var sl = document.createElement('input')
        sl.type = 'range'
        sl.className = 'aal-slider'
        sl.min = item.min
        sl.max = item.max
        sl.step = item.step
        sl.value = settings[item.key]
        var valSpan = document.createElement('span')
        valSpan.style.cssText =
          'font-size:11px;color:#2563eb;width:36px;text-align:right;font-family:system-ui,sans-serif;font-weight:600'
        valSpan.textContent = settings[item.key] + item.unit
        sl.addEventListener('input', function () {
          settings[item.key] = parseFloat(sl.value)
          valSpan.textContent = settings[item.key] + item.unit
          saveSettings()
          applySettings()
        })
        row.appendChild(sl)
        row.appendChild(valSpan)
      } else if (item.type === 'select') {
        var select = document.createElement('select')
        select.className = 'aal-select'
        item.options.forEach(function (option) {
          var opt = document.createElement('option')
          opt.value = option[0]
          opt.textContent = option[1]
          select.appendChild(opt)
        })
        select.value = settings[item.key] || item.options[0][0]
        select.addEventListener('change', function () {
          settings[item.key] = select.value
          saveSettings()
          applySettings()
        })
        row.appendChild(select)
      }
      c.appendChild(row)
    })
  }

  function renderShortcuts(c) {
    var shortcuts = [
      ['Ctrl + Shift + V', 'Abrir Voz'],
      ['Ctrl + Shift + A', 'Abrir Ações'],
      ['Ctrl + Shift + N', 'Abrir Navegação'],
      ['Ctrl + Shift + S', 'Abrir Configurações'],
      ['Esc', 'Fechar painel'],
    ]
    var help = document.createElement('div')
    help.className = 'aal-help'
    shortcuts.forEach(function (s) {
      var row = document.createElement('div')
      row.style.cssText = 'margin-bottom:8px'
      row.innerHTML = '<b>' + s[0] + '</b> — ' + s[1]
      help.appendChild(row)
    })
    c.appendChild(help)
  }

  function renderHighlight(c) {
    var row = document.createElement('div')
    row.className = 'aal-set'
    var lab = document.createElement('label')
    lab.textContent = 'Destacar elementos interativos'
    row.appendChild(lab)
    var tg = document.createElement('button')
    tg.className = 'aal-toggle' + (settings.highlight ? ' on' : '')
    tg.addEventListener('click', function () {
      settings.highlight = !settings.highlight
      saveSettings()
      applyHighlight()
      tg.classList.toggle('on')
    })
    row.appendChild(tg)
    c.appendChild(row)
    var info = document.createElement('div')
    info.className = 'aal-status'
    info.textContent = settings.highlight
      ? 'Elementos destacados com borda pulsante.'
      : 'Ative para destacar botões e links.'
    c.appendChild(info)
  }

  function semanticForElement(el) {
    if (!config || !config.entities || !el || !el.matches) return null
    for (var i = 0; i < config.entities.length; i++) {
      var ent = config.entities[i]
      var sel = ent.metadata && ent.metadata.cssSelector
      if (!sel) continue
      try {
        if (el.matches(sel) || (el.closest && el.closest(sel))) return ent
      } catch (e) {}
    }
    return null
  }

  function meaningfulTarget(el) {
    if (!el || !el.matches) return el
    var actionable = el.closest(
      'button,a,input,textarea,select,label,[role="button"],[role="link"],[aria-label],[placeholder],[data-skip-anchor]',
    )
    if (actionable && actionable !== document.body && actionable !== document.documentElement) return actionable
    if (el.matches('div,section,article,main,aside,header,footer')) {
      var child = el.querySelector(
        'button,a,input,textarea,select,label,[role="button"],[role="link"],[aria-label],[placeholder],h1,h2,h3,p',
      )
      if (child) return child
      var parentAction = el.closest('button,a,[role="button"],[role="link"],label')
      if (parentAction) return parentAction
    }
    return el
  }

  function elementLabel(el) {
    if (!el) return ''
    var labelledBy = el.getAttribute && el.getAttribute('aria-labelledby')
    var labelledText = ''
    if (labelledBy) {
      labelledText = labelledBy
        .split(/\s+/)
        .map(function (id) {
          var node = document.getElementById(id)
          return node ? node.innerText || node.textContent || '' : ''
        })
        .join(' ')
    }
    return String(
      labelledText ||
        el.getAttribute('aria-label') ||
        el.getAttribute('placeholder') ||
        el.getAttribute('title') ||
        el.getAttribute('name') ||
        el.innerText ||
        el.textContent ||
        el.value ||
        '',
    )
      .replace(/\s+/g, ' ')
      .trim()
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    })
  }

  function explainElement(el) {
    el = meaningfulTarget(el)
    var ent = semanticForElement(el)
    var label = (ent && ent.name) || elementLabel(el) || 'Item da tela'
    label = String(label || 'Item da tela').replace(/\s+/g, ' ').trim()
    var tag = el.tagName || ''
    var isField = el.matches && el.matches('input,textarea,select')
    var type = el.getAttribute && el.getAttribute('type')
    var description =
      (ent && (ent.accessibilityHint || ent.description)) ||
      (isField ? 'Campo para preencher ' + label.toLowerCase() + '.' : '') ||
      (tag === 'A' ? 'Link para abrir ' + label.toLowerCase() + '.' : '') ||
      (tag === 'BUTTON' || (el.getAttribute && el.getAttribute('role') === 'button')
        ? 'Botao para ' + label.toLowerCase() + '.'
        : '') ||
      (type === 'submit' ? 'Confirma os dados deste formulario.' : '') ||
      'Conteudo visivel nesta parte da tela.'
    return { title: label, description: description, entity: ent }
  }

  function clearGuidedSpotlight() {
    var old = container.querySelector('.aal-guide-layer')
    if (old) old.remove()
  }

  function showGuidedSpotlight(el) {
    clearGuidedSpotlight()
    el = meaningfulTarget(el)
    if (!el || !el.getBoundingClientRect) return
    var rect = el.getBoundingClientRect()
    var pad = 8
    var info = explainElement(el)
    var layer = document.createElement('div')
    layer.className = 'aal-guide-layer'

    var spot = document.createElement('div')
    spot.className = 'aal-guide-spot'
    spot.style.left = Math.max(8, rect.left - pad) + 'px'
    spot.style.top = Math.max(8, rect.top - pad) + 'px'
    spot.style.width = Math.max(36, rect.width + pad * 2) + 'px'
    spot.style.height = Math.max(28, rect.height + pad * 2) + 'px'
    layer.appendChild(spot)

    var card = document.createElement('div')
    card.className = 'aal-guide-card'
    var cardLeft = Math.min(window.innerWidth - 276, Math.max(8, rect.left))
    var cardTop = rect.bottom + 18
    if (cardTop > window.innerHeight - 150) cardTop = Math.max(8, rect.top - 160)
    card.style.left = cardLeft + 'px'
    card.style.top = cardTop + 'px'
    card.innerHTML =
      '<b>' +
      info.title.replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
      }) +
      '</b><span>' +
      info.description.replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
      }) +
      '</span><button type="button">Entendi</button>'
    card.querySelector('button').addEventListener('click', clearGuidedSpotlight)
    layer.appendChild(card)
    container.appendChild(layer)
  }

  function guidedClickCapture(e) {
    if (!guidedPicking) return
    var target = e.target
    if (!target || (target.closest && target.closest('#aal-widget-host'))) return
    e.preventDefault()
    e.stopPropagation()
    guidedPicking = false
    document.removeEventListener('click', guidedClickCapture, true)
    if (overlayEl) overlayEl.style.pointerEvents = 'auto'
    guidedTarget = meaningfulTarget(target)
    guidedStatus = 'Elemento selecionado. Veja o destaque na tela.'
    showGuidedSpotlight(guidedTarget)
    renderPanel()
    showGuidedSpotlight(guidedTarget)
  }

  function startGuidedPick() {
    document.removeEventListener('click', guidedClickCapture, true)
    guidedPicking = true
    guidedStatus = 'Clique em qualquer item da pagina para destacar e explicar.'
    if (overlayEl) overlayEl.style.pointerEvents = 'none'
    document.addEventListener('click', guidedClickCapture, true)
    renderPanel()
    if (overlayEl) overlayEl.style.pointerEvents = 'none'
  }

  function stopGuidedPick() {
    guidedPicking = false
    document.removeEventListener('click', guidedClickCapture, true)
    if (overlayEl) overlayEl.style.pointerEvents = 'auto'
  }

  function showGuidedPlan(steps, target) {
    guidedPlan = (steps || []).filter(function (step) {
      return step.action !== 'DONE'
    })
    guidedStatus = target
      ? 'Caminho para: ' + (target.name || target.path || 'destino')
      : 'Siga os passos destacados na tela.'
    voiceStatus = 'Modo guiado: siga os passos abaixo.'
    menuStack = ['main', 'guide']
    renderPanel()
    var firstClickable = guidedPlan.find(function (step) {
      return step.action === 'CLICK'
    })
    if (firstClickable) {
      var el = findElementForMatch(firstClickable.match || {})
      if (el) showGuidedSpotlight(el)
    }
  }

  function requestGuidedPath(input) {
    var transcript = String(input || '').trim()
    if (!transcript) return
    guidedStatus = 'Montando caminho...'
    renderPanel()
    apiPost('/backend/v1/widget/command', {
      transcript: transcript,
      path: window.location.pathname,
      url: window.location.href,
    })
      .then(function (data) {
        if (data.error) {
          guidedStatus = 'Erro: ' + data.error
          renderPanel()
          return
        }
        if (data.steps && data.steps.length) {
          showGuidedPlan(data.steps, (data.matches || [])[0])
        } else {
          guidedStatus = 'Nao encontrei um caminho clicavel para essa intencao.'
          guidedPlan = []
          renderPanel()
        }
      })
      .catch(function () {
        guidedStatus = 'Erro de conexao'
        renderPanel()
      })
  }

  function renderGuided(c) {
    var info = document.createElement('div')
    info.className = 'aal-status'
    info.textContent = guidedStatus || 'Digite onde quer chegar ou escolha um item da tela.'
    c.appendChild(info)

    var input = document.createElement('input')
    input.className = 'aal-search'
    input.placeholder = 'Ex: quero cancelar assinatura'
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') requestGuidedPath(input.value)
    })
    c.appendChild(input)

    var build = document.createElement('button')
    build.className = 'aal-btn'
    build.innerHTML = '<b>Mostrar caminho</b>'
    build.addEventListener('click', function () {
      requestGuidedPath(input.value)
    })
    c.appendChild(build)

    guidedPlan.slice(0, 5).forEach(function (step, index) {
      var btn = document.createElement('button')
      btn.className = 'aal-step'
      var label = step.label || (step.match && step.match.name) || step.reason || 'Passo'
      btn.innerHTML =
        '<span class="aal-step-num">' +
        (index + 1) +
        '</span><span><b>' +
        escapeHtml(label) +
        '</b><small>' +
        (step.action === 'CLICK'
          ? 'Clique neste item para continuar'
          : step.action === 'WAIT_INPUT'
            ? 'Preencha este campo'
            : step.action || '') +
        '</small></span>'
      btn.addEventListener('click', function () {
        if (step.action === 'CLICK') {
          var el = findElementForMatch(step.match || {})
          if (el) showGuidedSpotlight(el)
        }
      })
      c.appendChild(btn)
    })

    var start = document.createElement('button')
    start.className = 'aal-btn'
    start.innerHTML = '<b>Escolher item na tela</b><br><span style="font-size:11px;opacity:.65">Destaca o conteudo e a acao principal.</span>'
    start.addEventListener('click', startGuidedPick)
    c.appendChild(start)

    var clear = document.createElement('button')
    clear.className = 'aal-btn'
    clear.innerHTML = '<b>Limpar destaque</b>'
    clear.addEventListener('click', function () {
      stopGuidedPick()
      clearGuidedSpotlight()
      guidedStatus = ''
      renderPanel()
    })
    c.appendChild(clear)
  }

  function renderReading(c) {
    var row = document.createElement('div')
    row.className = 'aal-set'
    var lab = document.createElement('label')
    lab.textContent = 'Modo de leitura (TTS)'
    row.appendChild(lab)
    var tg = document.createElement('button')
    tg.className = 'aal-toggle' + (settings.tts ? ' on' : '')
    tg.addEventListener('click', function () {
      settings.tts = !settings.tts
      saveSettings()
      applyTTS()
      tg.classList.toggle('on')
    })
    row.appendChild(tg)
    c.appendChild(row)
    var info = document.createElement('div')
    info.className = 'aal-status'
    info.textContent = settings.tts
      ? 'TTS ativo — clique em elementos para ouvir.'
      : 'Ative para ouvir descrições ao focar elementos.'
    c.appendChild(info)
  }

  function renderHistory(c) {
    if (historyArr.length === 0) {
      c.innerHTML = '<div class="aal-empty">Nenhuma ação registrada.</div>'
      return
    }
    historyArr.forEach(function (h) {
      var row = document.createElement('div')
      row.className = 'aal-hist'
      row.innerHTML =
        '<b>' +
        h.action +
        '</b> ' +
        h.label +
        '<br><span style="opacity:0.5;font-size:10px">' +
        h.time +
        '</span>'
      c.appendChild(row)
    })
  }

  function renderHelp(c) {
    var help = document.createElement('div')
    help.className = 'aal-help'
    help.innerHTML = [
      '<p style="margin-bottom:8px"><b>AccessLayer</b> é uma camada de acessibilidade baseada em IA.</p>',
      '<p style="margin-bottom:6px"><b>Voz</b>: Comandos por voz em português. Diga o nome de uma página ou botão.</p>',
      '<p style="margin-bottom:6px"><b>Ações</b>: Lista de botões e links da página atual.</p>',
      '<p style="margin-bottom:6px"><b>Navegar</b>: Lista todas as rotas disponíveis.</p>',
      '<p style="margin-bottom:6px"><b>Destaque</b>: Destaca elementos interativos na tela.</p>',
      '<p style="margin-bottom:6px"><b>Leitura</b>: Lê descrições em voz alta.</p>',
      '<p style="margin-bottom:6px"><b>Config</b>: Ajuste fonte, contraste e velocidade.</p>',
      '<p style="margin-bottom:6px"><b>Arrastar</b>: Segure e arraste o botão para reposicioná-lo.</p>',
    ].join('')
    c.appendChild(help)
  }

  function applySettings() {
    applyFontScale()
    applyContrast()
    applyColorMode()
    applyReducedMotion()
  }
  function applyFontScale() {
    var existing = hostStyleEls.fontScale
    if (existing) existing.remove()
    if (settings.fontSize !== 100) {
      var s = document.createElement('style')
      s.id = 'aal-font-scale'
      s.textContent = 'html { font-size: ' + settings.fontSize + '% !important; }'
      document.head.appendChild(s)
      hostStyleEls.fontScale = s
    }
  }
  function applyContrast() {
    var existing = hostStyleEls.contrast
    if (existing) existing.remove()
    if (settings.highContrast) {
      var s = document.createElement('style')
      s.id = 'aal-contrast'
      s.textContent = 'html { filter: contrast(1.5) !important; }'
      document.head.appendChild(s)
      hostStyleEls.contrast = s
    }
  }
  function ensureColorFilters() {
    if (document.getElementById('aal-color-filters')) return
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('id', 'aal-color-filters')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('focusable', 'false')
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'
    svg.innerHTML =
      '<filter id="aal-protanopia"><feColorMatrix type="matrix" values="0.567 0.433 0 0 0 0.558 0.442 0 0 0 0 0.242 0.758 0 0 0 0 0 1 0"/></filter>' +
      '<filter id="aal-deuteranopia"><feColorMatrix type="matrix" values="0.625 0.375 0 0 0 0.7 0.3 0 0 0 0 0.3 0.7 0 0 0 0 0 1 0"/></filter>' +
      '<filter id="aal-tritanopia"><feColorMatrix type="matrix" values="0.95 0.05 0 0 0 0 0.433 0.567 0 0 0 0.475 0.525 0 0 0 0 0 1 0"/></filter>'
    document.body.appendChild(svg)
  }
  function applyColorMode() {
    var existing = hostStyleEls.colorMode
    if (existing) existing.remove()
    var mode = settings.colorMode || 'normal'
    if (mode === 'normal') return
    var filters = {
      protanopia: 'url("#aal-protanopia") saturate(1.15)',
      deuteranopia: 'url("#aal-deuteranopia") saturate(1.15)',
      tritanopia: 'url("#aal-tritanopia") saturate(1.15)',
      achromatopsia: 'grayscale(1) contrast(1.15)',
    }
    var s = document.createElement('style')
    s.id = 'aal-color-mode'
    s.textContent =
      'body { filter: ' +
      (filters[mode] || 'none') +
      ' !important; } #aal-widget-host { filter: none !important; }'
    document.head.appendChild(s)
    hostStyleEls.colorMode = s
    ensureColorFilters()
  }
  function applyReducedMotion() {
    var existing = hostStyleEls.motion
    if (existing) existing.remove()
    if (settings.reducedMotion) {
      var s = document.createElement('style')
      s.id = 'aal-motion'
      s.textContent =
        '*, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }'
      document.head.appendChild(s)
      hostStyleEls.motion = s
    }
  }
  function applyHighlight() {
    var existing = hostStyleEls.highlight
    if (existing) existing.remove()
    if (settings.highlight) {
      var s = document.createElement('style')
      s.id = 'aal-highlight'
      s.textContent =
        '.aal-highlighted { outline: 3px solid #2563eb !important; outline-offset: 2px !important; animation: aal-hl-pulse 1.5s infinite !important; } @keyframes aal-hl-pulse { 0%,100% { outline-color: #2563eb; } 50% { outline-color: rgba(37,99,235,0.3); } }'
      document.head.appendChild(s)
      hostStyleEls.highlight = s
      highlightElements()
    } else {
      document.querySelectorAll('.aal-highlighted').forEach(function (el) {
        el.classList.remove('aal-highlighted')
      })
    }
  }
  function highlightElements() {
    if (!config || !config.entities) return
    config.entities.forEach(function (ent) {
      if (ent.type === 'COMPONENT' && ent.metadata && ent.metadata.cssSelector) {
        var el = document.querySelector(ent.metadata.cssSelector)
        if (el) el.classList.add('aal-highlighted')
      }
    })
  }
  function applyTTS() {
    if (settings.tts) {
      document.addEventListener('focusin', ttsFocusHandler, true)
      document.addEventListener('click', ttsClickHandler, true)
    } else {
      document.removeEventListener('focusin', ttsFocusHandler, true)
      document.removeEventListener('click', ttsClickHandler, true)
      window.speechSynthesis.cancel()
    }
  }
  function speakText(text) {
    if (!text) return
    window.speechSynthesis.cancel()
    var u = new SpeechSynthesisUtterance(text)
    u.lang = settings.ttsLang === 'en' ? 'en-US' : 'pt-BR'
    u.rate = settings.ttsSpeed || 1
    window.speechSynthesis.speak(u)
  }
  function elementReadingContext(el) {
    var label =
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      el.getAttribute('title') ||
      el.innerText ||
      el.textContent ||
      el.value ||
      ''
    var role =
      el.getAttribute('role') ||
      (el.tagName ? el.tagName.toLowerCase() : '') ||
      ''
    return {
      label: String(label).replace(/\s+/g, ' ').trim().slice(0, 1000),
      role: role,
    }
  }
  function ttsClickHandler(e) {
    if (!settings.tts || ttsBusy) return
    if (guidedPicking || container.querySelector('.aal-guide-layer')) return
    var el = e.target
    if (!el || (el.closest && el.closest('#aal-widget-host'))) return
    var actionable = el.closest
      ? el.closest('button,a,label,input,textarea,select,[role="button"],[aria-label],p,h1,h2,h3,span,div') || el
      : el
    var ctx = elementReadingContext(actionable)
    if (!ctx.label) return
    ttsBusy = true
    apiPost('/backend/v1/widget/tts', {
      text: ctx.label,
      label: ctx.label,
      role: ctx.role,
      path: window.location.pathname,
      lang: settings.ttsLang || 'pt',
    })
      .then(function (data) {
        speakText(data.speech || ctx.label)
      })
      .catch(function () {
        speakText(ctx.label)
      })
      .then(function () {
        ttsBusy = false
      })
  }
  function ttsFocusHandler(e) {
    if (!settings.tts || !config || !config.entities) return
    if (guidedPicking || container.querySelector('.aal-guide-layer')) return
    var el = e.target
    var text = ''
    config.entities.forEach(function (ent) {
      if (ent.type === 'COMPONENT' && ent.metadata && ent.metadata.cssSelector) {
        if (el.matches && el.matches(ent.metadata.cssSelector)) {
          text = ent.accessibilityHint || ent.description || ent.name
        }
      }
    })
    if (text) {
      speakText(text)
    }
  }

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.shiftKey) {
        var key = e.key.toLowerCase()
        if (key === 'v') {
          e.preventDefault()
          if (!isOpen) openPanel()
          pushMenu('voice')
        } else if (key === 'a') {
          e.preventDefault()
          if (!isOpen) openPanel()
          pushMenu('actions')
        } else if (key === 'n') {
          e.preventDefault()
          if (!isOpen) openPanel()
          pushMenu('nav')
        } else if (key === 's') {
          e.preventDefault()
          if (!isOpen) openPanel()
          pushMenu('settings')
        }
      }
      if (e.key === 'Escape' && isOpen) closePanel()
    })
  }

  window.addEventListener('resize', function () {
    pos.x = Math.min(pos.x, window.innerWidth - 60)
    pos.y = Math.min(pos.y, window.innerHeight - 60)
    savePos()
    if (!isOpen) {
      var t = container.querySelector('.aal-trigger')
      if (t) {
        t.style.left = pos.x + 'px'
        t.style.top = pos.y + 'px'
      }
    }
  })

  function refreshWidgetPosition() {
    host.style.top = '0px'
    host.style.left = '0px'
    host.style.width = '100vw'
    host.style.height = '100vh'
    var t = container.querySelector('.aal-trigger')
    if (t) {
      t.style.left = pos.x + 'px'
      t.style.top = pos.y + 'px'
    }
  }
  window.addEventListener('scroll', refreshWidgetPosition, true)
  if (window.visualViewport) window.visualViewport.addEventListener('scroll', refreshWidgetPosition)

  applySettings()
  applyHighlight()
  applyTTS()
  applyVoiceMode()

  apiGet('/backend/v1/widget/config')
    .then(function (data) {
      config = data
      if (settings.highlight) highlightElements()
    })
    .catch(function () {})

  if (loadOpenState()) {
    isOpen = true
    renderPanel()
  } else {
    showTrigger()
  }
  setupKeyboardShortcuts()
  resumePendingPlanSoon()
})()
