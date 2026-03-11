(function () {
  'use strict';

  var script = document.currentScript;
  var apiKey = script.getAttribute('data-key');
  var appUrl = script.getAttribute('data-url') || 'https://receptai.bg';

  if (!apiKey) return;

  var sessionId = sessionStorage.getItem('receptai_session') || generateId();
  sessionStorage.setItem('receptai_session', sessionId);
  var history = [];
  var isOpen = false;
  var config = {
    businessName: 'AI Рецепционист',
    welcomeMessage: 'Здравейте! Как мога да ви помогна?'
  };

  function generateId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // Fetch config
  fetch(appUrl + '/api/widget/' + apiKey + '/config')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      config = data;
      updateUI();
    })
    .catch(function () {});

  // Inject styles
  var style = document.createElement('style');
  style.textContent = [
    '#receptai-btn {',
    '  position: fixed; bottom: 24px; right: 24px;',
    '  width: 56px; height: 56px; border-radius: 50%;',
    '  background: #16a34a; color: white; border: none;',
    '  cursor: pointer; box-shadow: 0 4px 16px rgba(22,163,74,0.5);',
    '  font-size: 24px; display: flex; align-items: center; justify-content: center;',
    '  z-index: 9999; transition: transform 0.2s;',
    '}',
    '#receptai-btn:hover { transform: scale(1.1); }',
    '#receptai-panel {',
    '  position: fixed; bottom: 90px; right: 24px;',
    '  width: 360px; max-height: 540px;',
    '  background: #0a0a0a; border: 1px solid rgba(255,255,255,0.1);',
    '  border-radius: 16px; display: flex; flex-direction: column;',
    '  box-shadow: 0 8px 32px rgba(0,0,0,0.6);',
    '  z-index: 9999; overflow: hidden;',
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
    '}',
    '#receptai-panel.hidden { display: none; }',
    '#receptai-header {',
    '  padding: 16px; background: #111; border-bottom: 1px solid rgba(255,255,255,0.08);',
    '  display: flex; align-items: center; gap: 10px;',
    '}',
    '#receptai-header .dot { width: 8px; height: 8px; border-radius: 50%; background: #16a34a; }',
    '#receptai-header h3 { margin: 0; font-size: 14px; font-weight: 600; color: #f0f0f0; }',
    '#receptai-messages {',
    '  flex: 1; overflow-y: auto; padding: 16px;',
    '  display: flex; flex-direction: column; gap: 8px;',
    '}',
    '.receptai-msg {',
    '  padding: 10px 14px; border-radius: 12px;',
    '  font-size: 13px; line-height: 1.5; max-width: 85%;',
    '}',
    '.receptai-msg.bot {',
    '  background: #1a1a1a; color: #e0e0e0; align-self: flex-start;',
    '  border: 1px solid rgba(255,255,255,0.06);',
    '}',
    '.receptai-msg.user {',
    '  background: #16a34a; color: white; align-self: flex-end;',
    '}',
    '#receptai-input-row {',
    '  padding: 12px; border-top: 1px solid rgba(255,255,255,0.08);',
    '  display: flex; gap: 8px;',
    '}',
    '#receptai-input {',
    '  flex: 1; padding: 10px 14px; border-radius: 10px;',
    '  background: #1a1a1a; border: 1px solid rgba(255,255,255,0.1);',
    '  color: #f0f0f0; font-size: 13px; outline: none;',
    '}',
    '#receptai-input:focus { border-color: #16a34a; }',
    '#receptai-send {',
    '  padding: 10px 14px; background: #16a34a; color: white;',
    '  border: none; border-radius: 10px; cursor: pointer;',
    '  font-size: 13px; font-weight: 500;',
    '}',
    '#receptai-send:hover { background: #15803d; }',
    '#receptai-send:disabled { opacity: 0.5; cursor: not-allowed; }',
  ].join('\n');
  document.head.appendChild(style);

  // Inject HTML
  var btn = document.createElement('button');
  btn.id = 'receptai-btn';
  btn.innerHTML = '&#x1F4AC;';
  btn.setAttribute('aria-label', 'Open chat');

  var panel = document.createElement('div');
  panel.id = 'receptai-panel';
  panel.classList.add('hidden');
  panel.innerHTML = [
    '<div id="receptai-header">',
    '  <div class="dot"></div>',
    '  <h3 id="receptai-title">AI \u0420\u0435\u0446\u0435\u043f\u0446\u0438\u043e\u043d\u0438\u0441\u0442</h3>',
    '</div>',
    '<div id="receptai-messages"></div>',
    '<div id="receptai-input-row">',
    '  <input id="receptai-input" type="text" placeholder="\u041d\u0430\u043f\u0438\u0448\u0435\u0442\u0435 \u0441\u044a\u043e\u0431\u0449\u0435\u043d\u0438\u0435..." />',
    '  <button id="receptai-send">\u0418\u0437\u043f\u0440\u0430\u0442\u0438</button>',
    '</div>',
  ].join('');

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  function updateUI() {
    var title = document.getElementById('receptai-title');
    if (title) title.textContent = config.businessName;
  }

  function addMessage(text, type) {
    var msgs = document.getElementById('receptai-messages');
    var div = document.createElement('div');
    div.className = 'receptai-msg ' + type;
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function openPanel() {
    isOpen = true;
    panel.classList.remove('hidden');
    btn.innerHTML = '&#x2715;';
    if (document.getElementById('receptai-messages').children.length === 0) {
      addMessage(config.welcomeMessage, 'bot');
    }
    document.getElementById('receptai-input').focus();
  }

  function closePanel() {
    isOpen = false;
    panel.classList.add('hidden');
    btn.innerHTML = '&#x1F4AC;';
  }

  btn.addEventListener('click', function () {
    if (isOpen) closePanel(); else openPanel();
  });

  function sendMessage() {
    var input = document.getElementById('receptai-input');
    var sendBtn = document.getElementById('receptai-send');
    var text = input.value.trim();
    if (!text) return;

    input.value = '';
    sendBtn.disabled = true;
    addMessage(text, 'user');

    var botDiv = addMessage('...', 'bot');
    var fullText = '';

    fetch(appUrl + '/api/chat/' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history, sessionId: sessionId }),
    })
      .then(function (response) {
        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        botDiv.textContent = '';

        function read() {
          return reader.read().then(function (result) {
            if (result.done) return;
            var lines = decoder.decode(result.value).split('\n');
            for (var i = 0; i < lines.length; i++) {
              var line = lines[i];
              if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                try {
                  var data = JSON.parse(line.slice(6));
                  if (data.text) {
                    fullText += data.text;
                    botDiv.textContent = fullText;
                    document.getElementById('receptai-messages').scrollTop = 99999;
                  }
                } catch (e) {
                  // ignore parse errors
                }
              }
            }
            return read();
          });
        }

        return read();
      })
      .then(function () {
        history.push({ role: 'user', content: text });
        history.push({ role: 'assistant', content: fullText });
        if (history.length > 20) history = history.slice(-20);
        sendBtn.disabled = false;
        document.getElementById('receptai-input').focus();
      })
      .catch(function () {
        botDiv.textContent = '\u0413\u0440\u0435\u0448\u043a\u0430. \u041e\u043f\u0438\u0442\u0430\u0439\u0442\u0435 \u043e\u0442\u043d\u043e\u0432\u043e.';
        sendBtn.disabled = false;
        document.getElementById('receptai-input').focus();
      });
  }

  document.getElementById('receptai-send').addEventListener('click', sendMessage);
  document.getElementById('receptai-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendMessage();
  });
})();
