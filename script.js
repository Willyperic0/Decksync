const _id = (e) => document.getElementById(e);
let currentView = 'grid';

// --- UTILIDADES ---
function getRootName(fullName) {
    const parts = fullName.trim().split(' ');
    if (parts.length > 2 && !isNaN(parts[parts.length - 1])) {
        return parts.slice(0, -2).join(' ').trim();
    }
    return fullName.trim();
}

function parse(txt) {
    const dict = {};
    txt.split('\n').forEach(l => {
        const clean = l.trim();
        if (!clean || clean.includes(':')) return;
        const m = clean.match(/^(\d+)\s+(.+)$/);
        if (m) {
            const q = parseInt(m[1]), n = m[2].trim();
            dict[n] = (dict[n] || 0) + q;
        }
    });
    return dict;
}

// --- API DECK-SYNC (Optimizado con Limitless TCG Fallback) ---
async function fetchImage(cardName, element) {
    if (currentView !== 'grid') return;
    
    const parts = cardName.split(' ');
    if (parts.length < 2) return;
    
    const num = parts.pop(); 
    const set = parts.pop().toUpperCase(); // Limitless requiere mayúsculas
    const nameOnly = parts.join(' ');

    const paddedNum = num.padStart(3, '0');
    const limitlessBase = "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com";

    try {
        // INTENTO 1: API Estándar Internacional
        let response = await fetch(`https://api.pokemontcg.io/v2/cards?q=set.ptcgoCode:${set} number:${num}`);
        let json = await response.json();

        if (json.data && json.data[0]) {
            element.style.backgroundImage = `url('${json.data[0].images.small}')`;
            element.querySelector('.card-label').style.display = 'none';
        } else {
            // INTENTO 2: Fallback Limitless (Estructura para Japón/TPC como la Red Card)
            // Formato: set/set_num_R_JP_LG.png
            const limitlessJpUrl = `${limitlessBase}/tpc/${set}/${set}_${num}_R_JP_LG.png`;
            
            const imgJp = new Image();
            imgJp.onload = () => {
                element.style.backgroundImage = `url('${limitlessJpUrl}')`;
                element.querySelector('.card-label').style.display = 'none';
            };
            
            // INTENTO 3: Fallback Limitless (Estructura Internacional/TPCi como Venusaur)
            // Formato: set/set_paddedNum_R_EN_LG.png
            imgJp.onerror = () => {
                const limitlessEnUrl = `${limitlessBase}/tpci/${set}/${set}_${paddedNum}_R_EN_LG.png`;
                const imgEn = new Image();
                imgEn.onload = () => {
                    element.style.backgroundImage = `url('${limitlessEnUrl}')`;
                    element.querySelector('.card-label').style.display = 'none';
                };
                imgEn.src = limitlessEnUrl;
            };
            
            imgJp.src = limitlessJpUrl;
        }
    } catch (e) {
        console.warn("Error de conexión al cargar asset para:", cardName);
    }
}

// --- RENDER ---
async function render(containerId, totalId, data) {
    const container = _id(containerId);
    container.innerHTML = '';
    let count = 0;
    
    container.className = `card-display ${currentView}-mode`;

    for (const [name, qty] of Object.entries(data)) {
        const item = document.createElement('div');
        if (currentView === 'grid') {
            item.className = 'tcg-card';
            item.innerHTML = `<div class="card-label">${getRootName(name)}</div><div class="qty-badge">${qty}</div>`;
            fetchImage(name, item);
        } else {
            item.className = 'deck-item';
            item.innerHTML = `<span class="qty">${qty}</span><span class="card-name">${name}</span>`;
        }
        container.appendChild(item);
        count += qty;
    }
    _id(totalId).innerText = `TOTAL: ${count}`;
    return count;
}

// --- ACCIONES ---
function setView(mode) {
    currentView = mode;
    _id('btn-list').classList.toggle('active', mode === 'list');
    _id('btn-grid').classList.toggle('active', mode === 'grid');
    if (_id('d1').value || _id('d2').value) sync();
}

async function sync() {
    const d1Raw = parse(_id('d1').value), d2Raw = parse(_id('d2').value);
    const d1Norm = {}, d2Norm = {}, rootToFull = {};

    Object.entries(d1Raw).forEach(([f, q]) => {
        const r = getRootName(f); d1Norm[r] = (d1Norm[r] || 0) + q; rootToFull[r] = f;
    });
    Object.entries(d2Raw).forEach(([f, q]) => {
        const r = getRootName(f); d2Norm[r] = (d2Norm[r] || 0) + q;
        if (!rootToFull[r]) rootToFull[r] = f;
    });

    const roots = new Set([...Object.keys(d1Norm), ...Object.keys(d2Norm)]);
    const res = { s: {}, a: {}, b: {} };

    roots.forEach(r => {
        const q1 = d1Norm[r] || 0, q2 = d2Norm[r] || 0, min = Math.min(q1, q2), f = rootToFull[r];
        if (min > 0) res.s[f] = min;
        if (q1 > min) res.a[f] = q1 - min;
        if (q2 > min) res.b[f] = q2 - min;
    });

    _id('res').style.display = 'grid';
    _id('sync-summary').style.display = 'flex';

    const c1 = await render('out-a', 't-a', res.a);
    const cs = await render('out-shared', 't-shared', res.s);
    const c2 = await render('out-b', 't-b', res.b);
    _id('total-global').innerText = c1 + cs + c2;
}