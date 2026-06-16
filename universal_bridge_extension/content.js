// =============================================================
// UNIVERSAL_BRIDGE.JS  —  Advanced AI-Learning PowerShell Bridge
// Draggable Setup Modal + Professional Run Popup
// =============================================================

(function () {
    'use strict';

    const POLL_MS    = 500;
    const domain     = window.location.hostname;
    const clientId   = Math.random().toString(36).substring(2, 10);

    let sessionToken = null;
    let lastSeenId   = -1;
    let isHandshaked = false;
    let setupMode    = false; 
    let activeStep   = 'copy'; // copy, prompt, send, method
    let handshakeInterval = null;
    
    let config = {
        copySelector: null,
        promptSelector: null,
        sendSelector: null,
        methodId: '1'
    };

    let lastClickedEl = null;
    let originalCapturedEl = null;

    // 1. INITIALIZE
    function init() {
        chrome.storage.local.get([domain], (result) => {
            if (result[domain]) {
                config = result[domain];
                log(`Loaded config for ${domain}`, 'gbp-log-ok');
            }
            createMainUI();
            startHandshake();
        });
    }

    // 2. MAIN UI PANEL (Bottom Right)
    let panel, statusLine, logBox;

    function createMainUI() {
        if (document.getElementById('uni-bridge-panel')) return;

        panel = document.createElement('div');
        panel.id = 'uni-bridge-panel';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;';
        
        const title = document.createElement('span');
        title.innerText = '⚡ Universal Bridge';
        title.style.color = '#a8c7fa';
        title.style.fontWeight = 'bold';

        const settingsBtn = document.createElement('span');
        settingsBtn.innerText = '⚙️';
        settingsBtn.style.cursor = 'pointer';
        settingsBtn.title = 'Open Setup Modal';
        settingsBtn.onclick = toggleSetupModal;

        header.appendChild(title);
        header.appendChild(settingsBtn);

        statusLine = document.createElement('div');
        statusLine.innerText = 'initializing...';
        statusLine.style.fontSize = '11px';
        statusLine.style.marginBottom = '8px';

        logBox = document.createElement('div');
        logBox.id = 'gbp-log';

        panel.appendChild(header);
        panel.appendChild(statusLine);
        panel.appendChild(logBox);

        const style = document.createElement('style');
        style.textContent = `
            #uni-bridge-panel {
                position: fixed; bottom: 20px; right: 20px; z-index: 999999;
                background: #1e1e24; color: #e3e2e6; border: 1px solid #444746;
                border-radius: 12px; padding: 12px 16px; font-family: 'Consolas', monospace;
                font-size: 12px; width: 220px; box-shadow: 0 4px 30px rgba(0,0,0,0.5);
                user-select: none;
            }
            #gbp-log { font-size: 10px; color: #888; max-height: 80px; overflow-y: auto; line-height: 1.4; border-top: 1px solid #333; padding-top: 6px; word-break: break-all; }
            .gbp-log-ok { color: #b4e391; }
            .gbp-log-err { color: #ffb4ab; }
            .gbp-log-inf { color: #a8c7fa; }

            /* SETUP MODAL STYLES */
            #gbp-setup-modal {
                position: fixed; top: 100px; left: 20px;
                width: 350px; background: #1e1e24; color: #fff; border: 2px solid #a8c7fa;
                border-radius: 16px; z-index: 1000001; padding: 0; font-family: sans-serif;
                box-shadow: 0 20px 60px rgba(0,0,0,0.8); display: none;
                overflow: hidden;
            }
            #gbp-modal-header {
                background: #2a2a32; padding: 12px 16px; cursor: move;
                border-bottom: 1px solid #444; display: flex; justify-content: space-between;
                align-items: center;
            }
            .modal-content { padding: 20px; }
            .modal-tabs { display: flex; gap: 4px; margin-bottom: 15px; border-bottom: 1px solid #444; padding-bottom: 8px; }
            .modal-tab { padding: 6px 12px; cursor: pointer; border-radius: 4px; font-size: 11px; background: #333; flex: 1; text-align: center; }
            .modal-tab.active { background: #a8c7fa; color: #1e1e24; font-weight: bold; }
            .modal-body { min-height: 140px; }
            .modal-footer { margin-top: 20px; display: flex; justify-content: flex-end; gap: 8px; }
            .m-btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; }
            .m-btn-save { background: #b4e391; color: #1e1e24; font-weight: bold; }
            .m-btn-close { background: #ffb4ab22; color: #ffb4ab; }
            .sel-input { width: 100%; background: #111; color: #a8c7fa; border: 1px solid #555; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 10px; margin: 10px 0; box-sizing: border-box; }
            .nav-btn { background: #444; color: #fff; border: 1px solid #555; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; margin-right: 5px; }
            .nav-btn:hover { background: #555; }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        createSetupModal();
    }

    // 3. SETUP MODAL (Draggable)
    let modal;

    function createSetupModal() {
        modal = document.createElement('div');
        modal.id = 'gbp-setup-modal';
        document.body.appendChild(modal);
        makeDraggable(modal);
        renderModal();
    }

    function makeDraggable(el) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const dragMouseDown = (e) => {
            const header = document.getElementById('gbp-modal-header');
            if (header && !header.contains(e.target)) return;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        };
        const elementDrag = (e) => {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            el.style.top = (el.offsetTop - pos2) + "px";
            el.style.left = (el.offsetLeft - pos1) + "px";
        };
        const closeDragElement = () => {
            document.onmouseup = null;
            document.onmousemove = null;
        };
        el.onmousedown = dragMouseDown;
    }

    function toggleSetupModal() {
        setupMode = !setupMode;
        modal.style.display = setupMode ? 'block' : 'none';
        if (setupMode) {
            document.addEventListener('click', onSetupInspect, true);
        } else {
            document.removeEventListener('click', onSetupInspect, true);
        }
    }

    function renderModal() {
        modal.innerHTML = '';
        
        const header = document.createElement('div');
        header.id = 'gbp-modal-header';
        const title = document.createElement('span');
        title.innerText = '⚙️ Bridge Setup';
        title.style.cssText = 'font-size:14px; font-weight:bold; color:#a8c7fa;';
        header.appendChild(title);
        const closeX = document.createElement('span');
        closeX.innerText = '✕';
        closeX.style.cssText = 'cursor:pointer; color:#aaa; font-family:sans-serif;';
        closeX.onclick = toggleSetupModal;
        header.appendChild(closeX);
        modal.appendChild(header);

        const content = document.createElement('div');
        content.className = 'modal-content';

        const tabs = document.createElement('div');
        tabs.className = 'modal-tabs';
        ['copy', 'prompt', 'send', 'method'].forEach(step => {
            const t = document.createElement('div');
            t.className = `modal-tab ${activeStep === step ? 'active' : ''}`;
            t.innerText = step.toUpperCase();
            t.onclick = () => { activeStep = step; renderModal(); };
            tabs.appendChild(t);
        });
        content.appendChild(tabs);

        const body = document.createElement('div');
        body.className = 'modal-body';

        if (activeStep !== 'method') {
            const currentSel = (activeStep === 'copy' ? config.copySelector : activeStep === 'prompt' ? config.promptSelector : config.sendSelector) || '';
            
            const label = document.createElement('div');
            label.innerText = `CAPTURE: ${activeStep.toUpperCase()}`;
            label.style.fontSize = '12px';
            body.appendChild(label);

            const input = document.createElement('input');
            input.className = 'sel-input';
            input.value = currentSel;
            input.placeholder = 'Click in page to capture...';
            input.oninput = (e) => {
                if (activeStep === 'copy') config.copySelector = e.target.value;
                if (activeStep === 'prompt') config.promptSelector = e.target.value;
                if (activeStep === 'send') config.sendSelector = e.target.value;
            };
            body.appendChild(input);

            const nav = document.createElement('div');
            const upBtn = document.createElement('button');
            upBtn.className = 'nav-btn';
            upBtn.innerText = '↑ Bubble Parent';
            upBtn.onclick = () => bubbleTree('UP');
            
            const downBtn = document.createElement('button');
            downBtn.className = 'nav-btn';
            downBtn.innerText = '↺ Reset';
            downBtn.onclick = () => bubbleTree('RESET');

            nav.appendChild(upBtn);
            nav.appendChild(downBtn);
            body.appendChild(nav);
        } else {
            const grid = document.createElement('div');
            grid.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:6px;';
            const methods = { 1:'Enter', 2:'Multi-Key', 3:'Click Btn', 4:'Form Sub' };
            Object.entries(methods).forEach(([id, name]) => {
                const b = document.createElement('button');
                b.className = 'modal-tab';
                if (config.methodId === id) b.classList.add('active');
                b.innerText = `M${id}: ${name}`;
                b.onclick = () => {
                    config.methodId = id;
                    log(`Testing M${id}...`, 'gbp-log-inf');
                    injectResult("TEST_SUBMIT");
                    renderModal();
                };
                grid.appendChild(b);
            });
            body.appendChild(grid);
        }
        content.appendChild(body);

        const footer = document.createElement('div');
        footer.className = 'modal-footer';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'm-btn m-btn-save';
        saveBtn.innerText = '✅ SAVE & LOCK';
        saveBtn.onclick = () => {
            saveConfig();
            log('Config saved!', 'gbp-log-ok');
            toggleSetupModal();
        };

        footer.appendChild(saveBtn);
        content.appendChild(footer);
        modal.appendChild(content);
    }

    function onSetupInspect(e) {
        if (!setupMode || activeStep === 'method') return;
        if (modal.contains(e.target) || panel.contains(e.target)) return;
        e.preventDefault(); e.stopPropagation();
        originalCapturedEl = e.target;
        lastClickedEl = e.target;
        updateConfigSelector(getUniqueSelector(e.target));
    }

    function bubbleTree(dir) {
        if (dir === 'RESET') lastClickedEl = originalCapturedEl;
        else if (dir === 'UP' && lastClickedEl && lastClickedEl.parentElement) lastClickedEl = lastClickedEl.parentElement;
        if (lastClickedEl) updateConfigSelector(getUniqueSelector(lastClickedEl));
    }

    function updateConfigSelector(sel) {
        if (activeStep === 'copy') config.copySelector = sel;
        if (activeStep === 'prompt') config.promptSelector = sel;
        if (activeStep === 'send') config.sendSelector = sel;
        renderModal();
    }

    function getUniqueSelector(el) {
        if (!el) return '';
        if (el.id && !el.id.startsWith('gbp-') && !el.id.startsWith('uni-')) return `#${CSS.escape(el.id)}`;
        const tagName = el.tagName.toLowerCase();
        const testAttrs = ['data-testid', 'aria-label', 'role'];
        for (let attr of testAttrs) {
            const val = el.getAttribute(attr);
            if (val) return `${tagName}[${attr}="${CSS.escape(val)}"]`;
        }
        let selector = tagName;
        if (el.classList.length > 0) {
            const classes = Array.from(el.classList).filter(c => !c.startsWith('gbp-')).map(c => `.${CSS.escape(c)}`).join('');
            selector += classes;
        }
        return selector;
    }

    function saveConfig() {
        const obj = {}; obj[domain] = config;
        chrome.storage.local.set(obj);
    }

    // 4. LOGGING & HANDSHAKE & POLLING
    function log(msg, cls = '') {
        const line = document.createElement('div');
        line.className = cls; line.innerText = msg;
        if (logBox) {
            logBox.appendChild(line);
            logBox.scrollTop = logBox.scrollHeight;
            while (logBox.children.length > 30) logBox.removeChild(logBox.firstChild);
        }
    }

    function setStatus(msg, color = '#aaa') {
        if (statusLine) { statusLine.innerText = msg; statusLine.style.color = color; }
    }

    function startHandshake() {
        handshakeInterval = setInterval(async () => {
            if (isHandshaked || setupMode) return;
            
            // 1. Try to write HANDSHAKE_REQ (usually allowed without user gesture in extension content scripts)
            try {
                const req = `[HANDSHAKE_REQ]\n${JSON.stringify({sender:"browser", action:"register", client:clientId})}\n[/HANDSHAKE_REQ]`;
                await navigator.clipboard.writeText(req);
                setStatus('handshaking...', '#ffdbc9');
            } catch (err) {
                // If writing fails, page might not be active/focused
            }

            // 2. Try to read HANDSHAKE_ACK (often requires focus/user gesture)
            try {
                const clip = await navigator.clipboard.readText();
                if (clip && clip.includes('[HANDSHAKE_ACK]')) {
                    const start = clip.indexOf('[HANDSHAKE_ACK]') + 15;
                    const end   = clip.indexOf('[/HANDSHAKE_ACK]');
                    if (start >= 15 && end > start) {
                        const data = JSON.parse(clip.substring(start, end).trim());
                        if (data.client === clientId) {
                            sessionToken = data.token; isHandshaked = true;
                            setStatus(`ready (ID: ${sessionToken})`, '#b4e391');
                            log(`Bridge Established!`, 'gbp-log-ok');
                            clearInterval(handshakeInterval);
                            startInboundPolling();
                            return;
                        }
                    }
                }
            } catch (err) { 
                setStatus('click page to sync clip', '#ffb4ab'); 
            }
        }, 1500);
    }

    // Global click listener to complete handshake upon user interaction
    document.addEventListener('click', async () => {
        if (isHandshaked || setupMode) return;
        try {
            const clip = await navigator.clipboard.readText();
            if (clip && clip.includes('[HANDSHAKE_ACK]')) {
                const start = clip.indexOf('[HANDSHAKE_ACK]') + 15;
                const end   = clip.indexOf('[/HANDSHAKE_ACK]');
                if (start >= 15 && end > start) {
                    const data = JSON.parse(clip.substring(start, end).trim());
                    if (data.client === clientId) {
                        sessionToken = data.token; isHandshaked = true;
                        setStatus(`ready (ID: ${sessionToken})`, '#b4e391');
                        log(`Bridge Established!`, 'gbp-log-ok');
                        if (handshakeInterval) clearInterval(handshakeInterval);
                        startInboundPolling();
                    }
                }
            }
        } catch (err) {}
    }, true);

    async function injectResult(text) {
        const editor = document.querySelector(config.promptSelector);
        if (!editor) { log('Prompt not found!', 'gbp-log-err'); return; }
        const isContentEditable = editor.isContentEditable;
        editor.focus();
        try {
            if (isContentEditable) {
                await navigator.clipboard.writeText(text);
                editor.focus();
                const sel = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(editor);
                sel.removeAllRanges();
                sel.addRange(range);
                document.execCommand('delete', false, null);
                document.execCommand('paste', false, null);
                if (!editor.innerText || !editor.innerText.trim()) {
                    document.execCommand('insertText', false, text);
                }
            } else {
                editor.value = text;
                editor.selectionStart = editor.selectionEnd = text.length;
            }
        } catch(e) {
            try { document.execCommand('insertText', false, text); } catch(e2) {}
        }
        ['input', 'change'].forEach(n => editor.dispatchEvent(new Event(n, { bubbles: true })));
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
        setTimeout(() => {
            setTimeout(() => {
                switch(config.methodId) {
                    case '1':
                        const e1 = { key: 'Enter', keyCode: 13, bubbles: true };
                        editor.dispatchEvent(new KeyboardEvent('keydown', e1));
                        editor.dispatchEvent(new KeyboardEvent('keyup', e1));
                        break;
                    case '2':
                        const e2 = { key: 'Enter', keyCode: 13, bubbles: true };
                        editor.dispatchEvent(new KeyboardEvent('keydown', e2));
                        editor.dispatchEvent(new KeyboardEvent('keypress', e2));
                        setTimeout(() => editor.dispatchEvent(new KeyboardEvent('keyup', e2)), 10);
                        break;
                    case '3':
                        const btn = document.querySelector(config.sendSelector);
                        if (btn) btn.click();
                        break;
                    case '4':
                        const form = editor.closest('form');
                        if (form) (form.requestSubmit ? form.requestSubmit() : form.submit());
                        break;
                }
            }, 300);
        }, 300);
    }

    function startInboundPolling() {
        let inboundInterval = setInterval(async () => {
            if (setupMode || !isHandshaked) return;
            try {
                const clip = await navigator.clipboard.readText();
                if (!clip || !clip.includes('[AGENT_RES]')) return;
                const start = clip.indexOf('[AGENT_RES]') + 12;
                const end   = clip.indexOf('[/AGENT_RES]');
                const data  = JSON.parse(clip.substring(start, end).trim());
                if (data.status === 'error' && data.result === 'INVALID_TOKEN') {
                    isHandshaked = false; sessionToken = null; clearInterval(inboundInterval);
                    startHandshake(); return;
                }
                if (data.token !== sessionToken || data.id === lastSeenId) return;
                lastSeenId = data.id;
                await injectResult(`[PS_RESULT id=${data.id}]\n${data.result}\n[/PS_RESULT]`);
            } catch (err) {}
        }, POLL_MS);
    }

    document.addEventListener('click', function(e) {
        if (setupMode || !isHandshaked || !config.copySelector) return;
        const match = e.target.closest(config.copySelector);
        if (match) {
            const rect = match.getBoundingClientRect();
            setTimeout(async () => {
                try {
                    const clip = await navigator.clipboard.readText();
                    if (clip && !clip.includes('[AGENT_')) showRunPopup(rect, clip.trim());
                } catch (err) { log('Clipboard read blocked', 'gbp-log-err'); }
            }, 300);
        }
    }, true);

    function showRunPopup(rect, cmd) {
        const old = document.getElementById('gbp-run-popup');
        if (old) old.remove();

        const popup = document.createElement('div');
        popup.id = 'gbp-run-popup';
        
        const preview = document.createElement('div');
        preview.style.cssText = 'white-space:pre; margin-bottom:8px; line-height:1.4; border-bottom:1px solid #a8c7fa33; padding-bottom:6px; color:#e3e2e6; font-size:10px;';
        preview.innerText = cmd.split('\n').slice(0, 3).map(l => l.length > 40 ? l.substring(0,40)+'...' : l).join('\n');

        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display:flex; gap:6px;';

        const runBtn = document.createElement('button');
        runBtn.innerText = 'Run in PS';
        runBtn.style.cssText = 'background:#a8c7fa22; color:#a8c7fa; border:1px solid #a8c7fa55; border-radius:4px; padding:4px 10px; cursor:pointer; font-family:Consolas,monospace; font-size:11px; flex:1;';

        const cancelBtn = document.createElement('button');
        cancelBtn.innerText = 'Cancel';
        cancelBtn.style.cssText = 'background:#ffb4ab22; color:#ffb4ab; border:1px solid #ffb4ab55; border-radius:4px; padding:4px 10px; cursor:pointer; font-family:Consolas,monospace; font-size:11px;';

        popup.style.cssText = `
            position: fixed; top: ${rect.bottom + 6}px; left: ${Math.max(10, rect.left - 100)}px;
            z-index: 10000000; background: #1e1e24; border: 1px solid #a8c7fa66;
            border-radius: 10px; padding: 10px; box-shadow: 0 4px 30px rgba(0,0,0,0.5);
            font-family: Consolas, monospace; min-width: 220px; max-width: 320px;
        `;

        runBtn.onclick = () => {
            const id = Math.floor(Math.random() * 1000);
            const payload = { sender:"br", token:sessionToken, id:id, cmd: btoa(unescape(encodeURIComponent(cmd))), encoding:"base64" };
            navigator.clipboard.writeText(`[AGENT_CMD]\n${JSON.stringify(payload)}\n[/AGENT_CMD]`);
            popup.remove();
            log(`Sent Command #${id}`, 'gbp-log-inf');
        };

        cancelBtn.onclick = () => popup.remove();

        btnContainer.appendChild(runBtn);
        btnContainer.appendChild(cancelBtn);
        popup.appendChild(preview);
        popup.appendChild(btnContainer);
        document.body.appendChild(popup);
        
        const killer = () => { popup.remove(); window.removeEventListener('scroll', killer); };
        window.addEventListener('scroll', killer);
    }

    init();
})();
