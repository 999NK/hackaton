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
    return { x: window.innerWidth - 80, y: window.innerHeight - 80 }
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
    }
  }
  function saveSettings() {
    try {
      localStorage.setItem('aal-widget-settings', JSON.stringify(settings))
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
    'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;'
  document.body.appendChild(host)
  var shadow = host.attachShadow({ mode: 'closed' })

  var styleEl = document.createElement('style')
  styleEl.textContent = [
    ':host { all: initial; }',
    '* { box-sizing: border-box; margin: 0; padding: 0; }',
    '.aal-trigger { position: fixed; width: 56px; height: 56px; border-radius: 50%; background: rgba(89,34,242,0.65); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.2); cursor: grab; pointer-events: auto; display: flex; align-items: center; justify-content: center; transition: opacity 0.3s, transform 0.2s; box-shadow: 0 4px 20px rgba(89,34,242,0.4); user-select: none; -webkit-user-select: none; touch-action: none; }',
    '.aal-trigger.idle { opacity: 0.4; }',
    '.aal-trigger:hover, .aal-trigger:active { opacity: 1; }',
    '.aal-trigger:active { cursor: grabbing; }',
    '.aal-trigger svg { width: 24px; height: 24px; fill: white; }',
    '.aal-overlay { position: fixed; inset: 0; pointer-events: auto; background: transparent; }',
    '.aal-panel { position: fixed; width: 280px; height: 280px; border-radius: 24px; background: rgba(20,20,30,0.88); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.1); pointer-events: auto; box-shadow: 0 8px 40px rgba(0,0,0,0.5); display: flex; flex-direction: column; overflow: hidden; transform-origin: center; animation: panelOpen 0.4s cubic-bezier(0.34,1.56,0.64,1); }',
    '.aal-panel.closing { animation: panelClose 0.3s ease forwards; }',
    '@keyframes panelOpen { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }',
    '@keyframes panelClose { from { transform: scale(1); opacity: 1; } to { transform: scale(0); opacity: 0; } }',
    '.aal-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; }',
    '.aal-title { color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 600; font-family: system-ui,-apple-system,sans-serif; flex: 1; text-align: center; }',
    '.aal-content { flex: 1; overflow-y: auto; padding: 8px; }',
    '.aal-content.slide-right { animation: slideR 0.3s ease; }',
    '.aal-content.slide-left { animation: slideL 0.3s ease; }',
    '@keyframes slideR { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }',
    '@keyframes slideL { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }',
    '.aal-ibtn { background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; padding: 4px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }',
    '.aal-ibtn:hover { background: rgba(255,255,255,0.1); color: white; }',
    '.aal-ibtn svg { width: 16px; height: 16px; fill: currentColor; }',
    '.aal-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; padding: 6px; }',
    '.aal-gi { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 10px 4px; border-radius: 14px; cursor: pointer; background: rgba(255,255,255,0.05); border: 1px solid transparent; transition: background 0.2s, border-color 0.2s; }',
    '.aal-gi:hover { background: rgba(89,34,242,0.2); border-color: rgba(89,34,242,0.4); }',
    '.aal-gi svg { width: 22px; height: 22px; fill: rgba(255,255,255,0.8); }',
    '.aal-gi span { font-size: 11px; color: rgba(255,255,255,0.7); font-family: system-ui,sans-serif; text-align: center; }',
    '.aal-status { padding: 8px 12px; font-size: 12px; color: rgba(255,255,255,0.7); font-family: system-ui,sans-serif; text-align: center; }',
    '.aal-transcript { padding: 8px 12px; font-size: 13px; color: white; font-family: system-ui,sans-serif; text-align: center; min-height: 20px; }',
    '.aal-btn { display: block; width: 100%; padding: 10px 12px; margin-bottom: 6px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white; font-size: 13px; font-family: system-ui,sans-serif; cursor: pointer; text-align: left; transition: background 0.2s; }',
    '.aal-btn:hover { background: rgba(89,34,242,0.2); }',
    '.aal-search { width: 100%; padding: 8px 12px; margin-bottom: 8px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); color: white; font-size: 13px; font-family: system-ui,sans-serif; outline: none; }',
    '.aal-search:focus { border-color: rgba(89,34,242,0.5); }',
    '.aal-set { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; }',
    '.aal-set label { font-size: 12px; color: rgba(255,255,255,0.8); font-family: system-ui,sans-serif; }',
    '.aal-slider { width: 80px; accent-color: #5922f2; }',
    '.aal-toggle { width: 36px; height: 20px; border-radius: 10px; background: rgba(255,255,255,0.2); border: none; cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0; }',
    '.aal-toggle.on { background: #5922f2; }',
    '.aal-toggle::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: white; transition: transform 0.2s; }',
    '.aal-toggle.on::after { transform: translateX(16px); }',
    '.aal-mic { display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 50%; background: rgba(89,34,242,0.3); border: 2px solid rgba(89,34,242,0.5); margin: 8px auto; cursor: pointer; transition: background 0.2s; }',
    '.aal-mic.on { background: rgba(239,68,68,0.3); border-color: rgba(239,68,68,0.5); animation: aalpulse 1.5s infinite; }',
    '.aal-mic svg { width: 24px; height: 24px; fill: white; }',
    '@keyframes aalpulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }',
    '.aal-mb { display: block; width: 100%; padding: 10px; margin-bottom: 6px; border-radius: 12px; border: 1px solid rgba(89,34,242,0.3); background: rgba(89,34,242,0.1); color: white; font-size: 13px; font-family: system-ui,sans-serif; cursor: pointer; text-align: left; }',
    '.aal-mb:hover { background: rgba(89,34,242,0.25); }',
    '.aal-mt { font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 2px; }',
    '.aal-ti { width: 100%; padding: 8px 12px; margin: 4px 0; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); color: white; font-size: 13px; font-family: system-ui,sans-serif; outline: none; }',
    '.aal-empty { text-align: center; padding: 20px; font-size: 12px; color: rgba(255,255,255,0.5); font-family: system-ui,sans-serif; }',
    '.aal-help { padding: 12px; font-size: 12px; color: rgba(255,255,255,0.7); font-family: system-ui,sans-serif; line-height: 1.6; }',
    '.aal-help b { color: white; }',
    '.aal-hist { padding: 8px 12px; font-size: 12px; color: rgba(255,255,255,0.7); font-family: system-ui,sans-serif; border-bottom: 1px solid rgba(255,255,255,0.05); }',
    '.aal-hist b { color: rgba(89,34,242,0.9); }',
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
    settings:
      '<svg viewBox="0 0 24 24"><path d="M19.14 12.94a7.49 7.49 0 000-1.88l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.61-.22l-2.39.96a7.03 7.03 0 00-1.62-.94l-.36-2.54a.5.5 0 00-.5-.42h-3.84a.5.5 0 00-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 00-.61.22L2.65 8.84a.5.5 0 00.12.64l2.03 1.58a7.49 7.49 0 000 1.88l-2.03 1.58a.5.5 0 00-.12.64l1.92 3.32c.14.24.42.34.68.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.26.12.54.02.68-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.03-1.58zM12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z"/></svg>',
    history:
      '<svg viewBox="0 0 24 24"><path d="M13 3a9 9 0 00-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 117 7 6.97 6.97 0 01-4.95-2.05l-1.42 1.41A8.954 8.954 0 0013 21a9 9 0 000-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>',
    help: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41a2 2 0 00-4 0H8a4 4 0 018 0c0 .88-.36 1.68-.93 2.25z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>',
    close:
      '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
  }

  var container = document.createElement('div')
  shadow.appendChild(container)

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
    trigger.innerHTML = icons.mic
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
    e.target.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e) {
    if (!dragData.dragging) return
    var dx = e.clientX - dragData.startX
    var dy = e.clientY - dragData.startY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragData.moved = true
    pos.x = Math.max(0, Math.min(dragData.origX + dx, window.innerWidth - 56))
    pos.y = Math.max(0, Math.min(dragData.origY + dy, window.innerHeight - 56))
    var t = container.querySelector('.aal-trigger')
    if (t) {
      t.style.left = pos.x + 'px'
      t.style.top = pos.y + 'px'
    }
  }
  function onPointerUp(e) {
    e.target.releasePointerCapture(e.pointerId)
    dragData.dragging = false
    if (!dragData.moved) {
      openPanel()
    } else {
      var snapX = pos.x + 28 < window.innerWidth / 2 ? 0 : window.innerWidth - 56
      pos.x = snapX
      pos.y = Math.max(0, Math.min(pos.y, window.innerHeight - 56))
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
    clearTimeout(idleTimer)
    render()
  }
  function closePanel() {
    var panel = container.querySelector('.aal-panel')
    if (panel) {
      panel.classList.add('closing')
      setTimeout(function () {
        isOpen = false
        menuStack = ['main']
        render()
      }, 280)
    } else {
      isOpen = false
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
    var px = Math.min(pos.x, window.innerWidth - 290)
    var py = Math.min(pos.y, window.innerHeight - 290)
    panel.style.left = Math.max(0, px) + 'px'
    panel.style.top = Math.max(0, py) + 'px'
    container.appendChild(panel)

    var current = menuStack[menuStack.length - 1]
    var titleMap = {
      main: config && config.project ? config.project.name : 'AccessLayer',
      voice: 'Voz',
      actions: 'Ações',
      shortcuts: 'Atalhos',
      highlight: 'Destaque',
      reading: 'Leitura',
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
      case 'reading':
        renderReading(content)
        break
      case 'nav':
        renderNav(content)
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
  }

  function renderMain(c) {
    var items = [
      { id: 'voice', icon: icons.mic, label: 'Voz' },
      { id: 'actions', icon: icons.actions, label: 'Ações' },
      { id: 'shortcuts', icon: icons.shortcuts, label: 'Atalhos' },
      { id: 'highlight', icon: icons.highlight, label: 'Destaque' },
      { id: 'reading', icon: icons.reading, label: 'Leitura' },
      { id: 'nav', icon: icons.nav, label: 'Navegar' },
      { id: 'settings', icon: icons.settings, label: 'Config' },
      { id: 'history', icon: icons.history, label: 'Histórico' },
      { id: 'help', icon: icons.help, label: 'Ajuda' },
    ]
    var grid = document.createElement('div')
    grid.className = 'aal-grid'
    items.forEach(function (item) {
      var gi = document.createElement('div')
      gi.className = 'aal-gi'
      gi.innerHTML = item.icon + '<span>' + item.label + '</span>'
      gi.addEventListener('click', function () {
        pushMenu(item.id)
      })
      grid.appendChild(gi)
    })
    c.appendChild(grid)
  }

  function renderVoice(c) {
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
  }

  function startListening() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    recognition = new SR()
    recognition.lang = 'pt-BR'
    recognition.continuous = false
    recognition.interimResults = true
    recognizing = true
    voiceStatus = 'Ouvindo...'
    voiceTranscript = ''
    voiceMatches = []
    renderPanel()

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
    }
    recognition.onend = function () {
      recognizing = false
      if (voiceTranscript.trim()) {
        voiceStatus = 'Processando...'
        renderPanel()
        processCommand(voiceTranscript.trim())
      } else {
        voiceStatus = 'Nada foi dito'
        renderPanel()
      }
    }
    recognition.start()
  }
  function stopListening() {
    if (recognition) recognition.stop()
    recognizing = false
    renderPanel()
  }

  function processCommand(transcript) {
    apiPost('/backend/v1/widget/command', { transcript: transcript })
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
        } else if (matches.length === 1) {
          executeCommand(matches[0], data.action, data.fillValue)
        } else {
          voiceStatus = 'Múltiplas opções encontradas:'
          voiceMatches = matches
          renderPanel()
        }
      })
      .catch(function () {
        voiceStatus = 'Erro de conexão'
        renderPanel()
      })
  }

  function executeCommand(match, action, fillValue) {
    if (!action) action = 'NAVIGATE'
    if (action === 'NAVIGATE' && match.path) {
      addHistory('NAVIGATE', match.name)
      window.location.href = match.path
      voiceStatus = '✓ Navegando para ' + match.name
    } else if (action === 'CLICK') {
      var sel = match.metadata ? match.metadata.cssSelector : ''
      if (sel) {
        var el = document.querySelector(sel)
        if (el) {
          el.click()
          addHistory('CLICK', match.name)
          voiceStatus = '✓ Ação executada: ' + match.name
        } else {
          voiceStatus = 'Elemento não encontrado'
        }
      } else {
        voiceStatus = 'Seletor não disponível'
      }
    } else if (action === 'FILL') {
      var sel2 = match.metadata ? match.metadata.cssSelector : ''
      if (sel2) {
        var el2 = document.querySelector(sel2)
        if (el2) {
          el2.value = fillValue || ''
          el2.dispatchEvent(new Event('input', { bubbles: true }))
          el2.dispatchEvent(new Event('change', { bubbles: true }))
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
            var sel = ent.metadata ? ent.metadata.cssSelector : ''
            if (sel) {
              var el = document.querySelector(sel)
              if (el) {
                el.click()
                addHistory('CLICK', ent.name)
              }
            } else if (ent.path) {
              window.location.href = ent.path
              addHistory('NAVIGATE', ent.name)
            }
          })
          c.appendChild(btn)
        })
      })
      .catch(function () {
        c.innerHTML = '<div class="aal-empty">Erro ao carregar ações.</div>'
      })
  }

  function renderNav(c) {
    var search = document.createElement('input')
    search.className = 'aal-search'
    search.placeholder = 'Buscar rotas...'
    c.appendChild(search)
    var list = document.createElement('div')
    c.appendChild(list)
    var loading = document.createElement('div')
    loading.className = 'aal-status'
    loading.textContent = 'Carregando rotas...'
    list.appendChild(loading)

    apiGet('/backend/v1/widget/sitemap')
      .then(function (data) {
        var routes = data.routes || []
        function filterRoutes(q) {
          list.innerHTML = ''
          if (routes.length === 0) {
            list.innerHTML = '<div class="aal-empty">Nenhuma rota encontrada.</div>'
            return
          }
          var filtered = q
            ? routes.filter(function (r) {
                return (
                  (r.name || '').toLowerCase().indexOf(q.toLowerCase()) > -1 ||
                  (r.path || '').toLowerCase().indexOf(q.toLowerCase()) > -1 ||
                  (r.pageTitle || '').toLowerCase().indexOf(q.toLowerCase()) > -1
                )
              })
            : routes
          filtered.forEach(function (r) {
            var btn = document.createElement('button')
            btn.className = 'aal-btn'
            btn.innerHTML =
              '<b>' +
              (r.pageTitle || r.name) +
              '</b>' +
              (r.path
                ? '<br><span style="font-size:11px;opacity:0.6;font-family:monospace">' +
                  r.path +
                  '</span>'
                : '')
            btn.addEventListener('click', function () {
              if (r.path) {
                addHistory('NAVIGATE', r.name)
                window.location.href = r.path
              }
            })
            list.appendChild(btn)
          })
        }
        search.addEventListener('input', function () {
          filterRoutes(search.value)
        })
        filterRoutes('')
      })
      .catch(function () {
        list.innerHTML = '<div class="aal-empty">Erro ao carregar rotas.</div>'
      })
  }

  function renderSettings(c) {
    var items = [
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
        key: 'ttsSpeed',
        label: 'Velocidade TTS',
        type: 'slider',
        min: 0.5,
        max: 2,
        step: 0.1,
        unit: 'x',
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
          'font-size:11px;color:rgba(255,255,255,0.6);width:36px;text-align:right;font-family:system-ui,sans-serif'
        valSpan.textContent = settings[item.key] + item.unit
        sl.addEventListener('input', function () {
          settings[item.key] = parseFloat(sl.value)
          valSpan.textContent = settings[item.key] + item.unit
          saveSettings()
          applySettings()
        })
        row.appendChild(sl)
        row.appendChild(valSpan)
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
        '.aal-highlighted { outline: 3px solid #5922f2 !important; outline-offset: 2px !important; animation: aal-hl-pulse 1.5s infinite !important; } @keyframes aal-hl-pulse { 0%,100% { outline-color: #5922f2; } 50% { outline-color: rgba(89,34,242,0.3); } }'
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
    } else {
      document.removeEventListener('focusin', ttsFocusHandler, true)
      window.speechSynthesis.cancel()
    }
  }
  function ttsFocusHandler(e) {
    if (!settings.tts || !config || !config.entities) return
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
      window.speechSynthesis.cancel()
      var u = new SpeechSynthesisUtterance(text)
      u.lang = 'pt-BR'
      u.rate = settings.ttsSpeed || 1
      window.speechSynthesis.speak(u)
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
    pos.x = Math.min(pos.x, window.innerWidth - 56)
    pos.y = Math.min(pos.y, window.innerHeight - 56)
    savePos()
    if (!isOpen) {
      var t = container.querySelector('.aal-trigger')
      if (t) {
        t.style.left = pos.x + 'px'
        t.style.top = pos.y + 'px'
      }
    }
  })

  applySettings()
  applyHighlight()
  applyTTS()

  apiGet('/backend/v1/widget/config')
    .then(function (data) {
      config = data
      if (settings.highlight) highlightElements()
    })
    .catch(function () {})

  showTrigger()
  setupKeyboardShortcuts()
})()
