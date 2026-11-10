const suits = ['hearts', 'diamonds', 'spades', 'clubs'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Palos asignados por diseño a cada una de las 8 fundaciones
const foundationSuits = ['hearts', 'hearts', 'diamonds', 'diamonds', 'spades', 'spades', 'clubs', 'clubs'];

let deck = [];
let stock = [];
let waste = [];
let foundations = [[], [], [], [], [], [], [], []]; // 8 fundaciones
let tableau = [[], [], [], [], [], [], [], [], [], []]; // 10 columnas
let selectedCards = null;
let draggedItem = null;

const stockEl = document.getElementById('stock');
const wasteEl = document.getElementById('waste');
const foundationEls = [
    document.getElementById('foundation-0'),
    document.getElementById('foundation-1'),
    document.getElementById('foundation-2'),
    document.getElementById('foundation-3'),
    document.getElementById('foundation-4'),
    document.getElementById('foundation-5'),
    document.getElementById('foundation-6'),
    document.getElementById('foundation-7')
];
const tableauEls = [
    document.getElementById('tableau-0'),
    document.getElementById('tableau-1'),
    document.getElementById('tableau-2'),
    document.getElementById('tableau-3'),
    document.getElementById('tableau-4'),
    document.getElementById('tableau-5'),
    document.getElementById('tableau-6'),
    document.getElementById('tableau-7'),
    document.getElementById('tableau-8'),
    document.getElementById('tableau-9')
];
const gameContainer = document.getElementById('game-container');

function initGame() {
    deck = createDoubleDeck();
    shuffle(deck);
    
    stock = [];
    waste = [];
    foundations = [[], [], [], [], [], [], [], []];
    tableau = [[], [], [], [], [], [], [], [], [], []];
    selectedCards = null;
    draggedItem = null;
    document.getElementById('message').textContent = '';

    // Reparto estándar de Doble Solitario: 10 columnas crecientes de 1 a 10 cartas (55 cartas en total)
    const pileSizes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    
    for (let i = 0; i < 10; i++) {
        let count = pileSizes[i];
        for (let j = 0; j < count; j++) {
            let card = deck.pop();
            card.faceUp = (j === count - 1); // Solo la carta superior queda boca arriba
            tableau[i].push(card);
        }
    }

    // El resto al stock (49 cartas)
    stock = deck;
    stock.forEach(card => card.faceUp = false);

    render();
}

function createDoubleDeck() {
    let newDeck = [];
    for (let d = 0; d < 2; d++) {
        for (let suit of suits) {
            for (let i = 0; i < values.length; i++) {
                newDeck.push({
                    id: `${d}-${suit}-${values[i]}`,
                    suit: suit,
                    value: values[i],
                    numericValue: i + 1,
                    color: (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black',
                    faceUp: false
                });
            }
        }
    }
    return newDeck;
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Variables globales para arrastre unificado (táctil y ratón) y doble tap
let dragContext = null;
let lastTapTime = 0;
let lastTapCardId = null;
let lastStartTimestamp = 0;

// Prevenir el arrastre nativo por defecto del navegador para no interferir con nuestro arrastre
window.addEventListener('dragstart', (e) => e.preventDefault());

// Deseleccionar al hacer clic en el tapete de fondo
gameContainer.addEventListener('click', (e) => {
    if (!e.target.closest('.card') && !e.target.closest('.pile') && !e.target.closest('.tableau-pile')) {
        clearSelection();
    }
});

// Interacción con el mazo (Stock)
stockEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (stock.length > 0) {
        let card = stock.pop();
        card.faceUp = true;
        waste.push(card);
    } else if (waste.length > 0) {
        while (waste.length > 0) {
            let card = waste.pop();
            card.faceUp = false;
            stock.push(card);
        }
    }
    clearSelection();
});

// Extrae coordenadas tanto de eventos Pointer/Mouse como de eventos Touch (pantallas táctiles y modo responsive)
function getEventCoords(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
        return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

// Manejador centralizado de pulsación / doble clic / doble tap
function handleCardTap(source, pileIndex, cardIndex, card) {
    const now = Date.now();
    const cardId = card.id || `${card.suit}-${card.value}`;

    // Si se pulsa la misma carta en menos de 360ms -> ¡Doble clic / Doble tap para auto-enviar a fundación!
    if (lastTapCardId === cardId && (now - lastTapTime) < 360) {
        lastTapTime = 0;
        lastTapCardId = null;
        tryAutoSendToFoundation(source, pileIndex, cardIndex);
        return;
    }

    lastTapTime = now;
    lastTapCardId = cardId;

    if (source === 'waste') {
        handleWasteClick();
    } else if (source === 'foundation') {
        handleFoundationClick(pileIndex);
    } else if (source === 'tableau') {
        handleTableauCardClick(pileIndex, cardIndex);
    }
}

// Inicia la interacción de toque/puntero sobre una carta
function onStartDrag(e, card, source, pileIndex, cardIndex) {
    if (e.button !== undefined && e.button !== 0) return;
    if (!card.faceUp) return;

    // Evitar disparar dos veces si el navegador emite pointerdown y touchstart simultáneamente
    const now = Date.now();
    if (now - lastStartTimestamp < 40) return;
    lastStartTimestamp = now;

    const coords = getEventCoords(e);
    const cardEl = e.currentTarget;
    const rect = cardEl.getBoundingClientRect();

    let movingCards = [card];
    let canDrag = true;
    if (source === 'tableau') {
        movingCards = tableau[pileIndex].slice(cardIndex);
        canDrag = isValidSubStack(movingCards);
    }

    if (e.pointerId && cardEl.setPointerCapture) {
        try { cardEl.setPointerCapture(e.pointerId); } catch (_) {}
    }

    dragContext = {
        pointerId: e.pointerId ?? null,
        targetCardEl: cardEl,
        startX: coords.x,
        startY: coords.y,
        offsetX: coords.x - rect.left,
        offsetY: coords.y - rect.top,
        source,
        pileIndex,
        foundationIndex: (source === 'foundation') ? pileIndex : undefined,
        cardIndex,
        card,
        cards: movingCards,
        canDrag,
        isDragging: false,
        sourceElements: [],
        floatingContainer: null
    };
}

// Movimiento del cursor o dedo durante el arrastre
function onMoveDrag(e) {
    if (!dragContext) return;

    const coords = getEventCoords(e);
    const dx = coords.x - dragContext.startX;
    const dy = coords.y - dragContext.startY;
    const distance = Math.hypot(dx, dy);

    // Activar arrastre visual al superar umbral de 5px
    if (!dragContext.isDragging && distance > 5) {
        if (!dragContext.canDrag) return;

        dragContext.isDragging = true;
        selectedCards = null;

        if (e.cancelable) {
            e.preventDefault();
        }

        // Atenuar las cartas originales en el tablero
        let sourceEls = [];
        if (dragContext.source === 'tableau') {
            const pileEl = tableauEls[dragContext.pileIndex];
            const allCardEls = Array.from(pileEl.querySelectorAll('.card'));
            sourceEls = allCardEls.slice(dragContext.cardIndex);
        } else if (dragContext.source === 'waste') {
            const topCardEl = wasteEl.querySelector('.card');
            if (topCardEl) sourceEls = [topCardEl];
        } else if (dragContext.source === 'foundation') {
            const topCardEl = foundationEls[dragContext.pileIndex].querySelector('.card');
            if (topCardEl) sourceEls = [topCardEl];
        }

        sourceEls.forEach(el => el.classList.add('dragging-source'));
        dragContext.sourceElements = sourceEls;

        // Crear contenedor flotante con las cartas clonadas
        const container = document.createElement('div');
        container.className = 'drag-floating-container';

        const cascadeStep = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cascade-step')) || 20;

        dragContext.cards.forEach((c, idx) => {
            const clone = createCardElement(c);
            clone.style.top = `${idx * cascadeStep}px`;
            clone.style.left = '0';
            clone.style.zIndex = 100 + idx;
            container.appendChild(clone);
        });

        document.body.appendChild(container);
        dragContext.floatingContainer = container;
    }

    if (dragContext.isDragging) {
        if (e.cancelable) {
            e.preventDefault();
        }
        if (dragContext.floatingContainer) {
            const posX = coords.x - dragContext.offsetX;
            const posY = coords.y - dragContext.offsetY;
            dragContext.floatingContainer.style.transform = `translate3d(${posX}px, ${posY}px, 0)`;
        }
    }
}

// Finalización del arrastre al levantar el dedo o soltar el clic
function onEndDrag(e) {
    if (!dragContext) return;

    const coords = getEventCoords(e);
    const ctx = dragContext;
    dragContext = null;

    if (ctx.targetCardEl && ctx.pointerId && ctx.targetCardEl.releasePointerCapture) {
        try { ctx.targetCardEl.releasePointerCapture(ctx.pointerId); } catch (_) {}
    }

    if (ctx.isDragging) {
        if (ctx.floatingContainer) {
            ctx.floatingContainer.remove();
        }
        if (ctx.sourceElements) {
            ctx.sourceElements.forEach(el => el.classList.remove('dragging-source'));
        }

        // Buscar qué elemento del tablero está bajo el dedo/cursor
        const targetEl = document.elementFromPoint(coords.x, coords.y);
        let moveExecuted = false;

        if (targetEl) {
            // 1. ¿Se soltó sobre una fundación?
            const foundationEl = targetEl.closest('.foundation');
            if (foundationEl) {
                const targetFoundationIndex = foundationEls.indexOf(foundationEl);
                if (targetFoundationIndex !== -1) {
                    const card = ctx.card || ctx.cards[0];
                    const isSingleCard = ctx.cards.length === 1;

                    if (isSingleCard && canPlaceOnFoundation(card, targetFoundationIndex)) {
                        executeMoveToFoundation(card, ctx, targetFoundationIndex);
                        moveExecuted = true;
                    }
                }
            }

            // 2. ¿Se soltó sobre una columna del Tableau?
            if (!moveExecuted) {
                const tableauEl = targetEl.closest('.tableau-pile');
                if (tableauEl) {
                    const targetPileIndex = tableauEls.indexOf(tableauEl);
                    if (targetPileIndex !== -1) {
                        const isSamePile = (ctx.source === 'tableau' && ctx.pileIndex === targetPileIndex);
                        if (!isSamePile) {
                            const targetPile = tableau[targetPileIndex];
                            const topTargetCard = targetPile.length > 0 ? targetPile[targetPile.length - 1] : null;
                            const firstMovingCard = ctx.cards[0];

                            if (isValidTableauMove(firstMovingCard, topTargetCard)) {
                                executeMoveToTableau(ctx.cards, ctx, targetPileIndex);
                                moveExecuted = true;
                            }
                        }
                    }
                }
            }
        }

        clearSelection();
        return;
    }

    // Si NO se desplazó, fue un simple tap / clic (o doble tap)
    handleCardTap(ctx.source, ctx.pileIndex, ctx.cardIndex, ctx.card);
}

// Listeners globales para movimiento y suelta (Pointer + Touch)
window.addEventListener('pointermove', onMoveDrag, { passive: false });
window.addEventListener('touchmove', onMoveDrag, { passive: false });

window.addEventListener('pointerup', onEndDrag);
window.addEventListener('touchend', onEndDrag);

window.addEventListener('pointercancel', onEndDrag);
window.addEventListener('touchcancel', onEndDrag);

// Asocia eventos Pointer y Touch a cada carta
function attachCardInteractions(cardDiv, card, source, pileIndex, cardIndex) {
    cardDiv.addEventListener('pointerdown', (e) => onStartDrag(e, card, source, pileIndex, cardIndex));
    cardDiv.addEventListener('touchstart', (e) => onStartDrag(e, card, source, pileIndex, cardIndex), { passive: true });
}

// Renderizado visual completo del tablero
function render() {
    // 1. Render Stock
    stockEl.innerHTML = '';
    if (stock.length > 0) {
        let cardDiv = createCardElement(stock[stock.length - 1]);
        stockEl.appendChild(cardDiv);
    }

    // 2. Render Waste
    wasteEl.innerHTML = '';
    if (waste.length > 0) {
        let topWaste = waste[waste.length - 1];
        let cardDiv = createCardElement(topWaste);
        
        attachCardInteractions(cardDiv, topWaste, 'waste', null, waste.length - 1);

        cardDiv.ondblclick = (e) => {
            e.stopPropagation();
            tryAutoSendToFoundation('waste');
        };

        wasteEl.appendChild(cardDiv);
    }

    // 3. Render Foundations
    foundationEls.forEach((el, index) => {
        el.innerHTML = '';
        let pile = foundations[index];

        if (pile.length > 0) {
            let topCard = pile[pile.length - 1];
            let cardDiv = createCardElement(topCard);

            attachCardInteractions(cardDiv, topCard, 'foundation', index, pile.length - 1);
            el.appendChild(cardDiv);
        } else {
            el.onclick = (e) => {
                e.stopPropagation();
                handleFoundationClick(index);
            };
        }
    });

    // 4. Render Tableau
    tableauEls.forEach((el, pileIndex) => {
        el.innerHTML = '';
        let pile = tableau[pileIndex];

        // Definir variable CSS para la altura dinámica de la columna
        el.style.setProperty('--card-count', pile.length);

        // Clic en la columna (cubre el área vacía o la base de la columna)
        el.onclick = (e) => {
            e.stopPropagation();
            handleTableauPileClick(pileIndex);
        };

        pile.forEach((card, cardIndex) => {
            let cardDiv = createCardElement(card);
            cardDiv.style.setProperty('--card-index', cardIndex);
            cardDiv.style.zIndex = cardIndex + 1;

            if (card.faceUp) {
                attachCardInteractions(cardDiv, card, 'tableau', pileIndex, cardIndex);

                cardDiv.ondblclick = (e) => {
                    e.stopPropagation();
                    if (cardIndex === pile.length - 1) {
                        tryAutoSendToFoundation('tableau', pileIndex, cardIndex);
                    }
                };
            } else {
                cardDiv.onclick = (e) => {
                    e.stopPropagation();
                    if (cardIndex === pile.length - 1 && !card.faceUp) {
                        card.faceUp = true;
                        clearSelection();
                    }
                };
            }

            el.appendChild(cardDiv);
        });
    });

    checkWinCondition();
}

function getSuitSymbol(suit) {
    switch (suit) {
        case 'hearts': return '♥';
        case 'diamonds': return '♦';
        case 'spades': return '♠';
        case 'clubs': return '♣';
        default: return '';
    }
}

// Disposiciones clásicas de pips en naipes para cada valor del As al 10
const pipLayouts = {
    'A': [
        { x: 50, y: 50, size: 'size-large' }
    ],
    '2': [
        { x: 50, y: 22, size: 'size-med' },
        { x: 50, y: 78, size: 'size-med', flip: true }
    ],
    '3': [
        { x: 50, y: 22, size: 'size-med' },
        { x: 50, y: 50, size: 'size-med' },
        { x: 50, y: 78, size: 'size-med', flip: true }
    ],
    '4': [
        { x: 26, y: 22 }, { x: 74, y: 22 },
        { x: 26, y: 78, flip: true }, { x: 74, y: 78, flip: true }
    ],
    '5': [
        { x: 26, y: 22 }, { x: 74, y: 22 },
        { x: 50, y: 50 },
        { x: 26, y: 78, flip: true }, { x: 74, y: 78, flip: true }
    ],
    '6': [
        { x: 26, y: 22 }, { x: 74, y: 22 },
        { x: 26, y: 50 }, { x: 74, y: 50 },
        { x: 26, y: 78, flip: true }, { x: 74, y: 78, flip: true }
    ],
    '7': [
        { x: 26, y: 20 }, { x: 74, y: 20 },
        { x: 50, y: 35 },
        { x: 26, y: 50 }, { x: 74, y: 50 },
        { x: 26, y: 80, flip: true }, { x: 74, y: 80, flip: true }
    ],
    '8': [
        { x: 26, y: 20 }, { x: 74, y: 20 },
        { x: 50, y: 34 },
        { x: 26, y: 50 }, { x: 74, y: 50 },
        { x: 50, y: 66, flip: true },
        { x: 26, y: 80, flip: true }, { x: 74, y: 80, flip: true }
    ],
    '9': [
        { x: 26, y: 18 }, { x: 74, y: 18 },
        { x: 26, y: 39 }, { x: 74, y: 39 },
        { x: 50, y: 50 },
        { x: 26, y: 61, flip: true }, { x: 74, y: 61, flip: true },
        { x: 26, y: 82, flip: true }, { x: 74, y: 82, flip: true }
    ],
    '10': [
        { x: 26, y: 16, size: 'size-small' }, { x: 74, y: 16, size: 'size-small' },
        { x: 50, y: 28, size: 'size-small' },
        { x: 26, y: 39, size: 'size-small' }, { x: 74, y: 39, size: 'size-small' },
        { x: 26, y: 61, size: 'size-small', flip: true }, { x: 74, y: 61, size: 'size-small', flip: true },
        { x: 50, y: 72, size: 'size-small', flip: true },
        { x: 26, y: 84, size: 'size-small', flip: true }, { x: 74, y: 84, size: 'size-small', flip: true }
    ]
};

function getPipsHtml(value, suitSymbol) {
    const layout = pipLayouts[value];
    if (!layout) return '';

    let html = '<div class="pips-container">';
    layout.forEach(p => {
        let classes = ['pip'];
        if (p.flip) classes.push('flip');
        if (p.size) classes.push(p.size);
        html += `<div class="${classes.join(' ')}" style="left: ${p.x}%; top: ${p.y}%;">${suitSymbol}</div>`;
    });
    html += '</div>';
    return html;
}

// Ilustraciones SVG de cartas de figuras de la corte (J, Q, K)
function getFaceCardSvg(value, suit, color) {
    const mainSuitColor = (color === 'red') ? '#c62828' : '#212121';
    const suitSymbol = getSuitSymbol(suit);

    if (value === 'J') {
        // Jack / Sota: Joven caballero con boina renacentista con pluma, gorguera y espada
        return `
        <svg class="face-art-svg" viewBox="0 0 100 190" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="gold-grad-j" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#f9e79f" />
                    <stop offset="50%" stop-color="#d4af37" />
                    <stop offset="100%" stop-color="#b7950b" />
                </linearGradient>
            </defs>
            <!-- Marco ornamental -->
            <rect x="2" y="2" width="96" height="186" rx="4" fill="#faf8f5" stroke="url(#gold-grad-j)" stroke-width="2.5"/>
            <rect x="6" y="6" width="88" height="178" rx="2" fill="none" stroke="${mainSuitColor}" stroke-width="0.8" opacity="0.6"/>
            
            <!-- Ropa y hombreras -->
            <path d="M 12 184 L 20 125 L 80 125 L 88 184 Z" fill="${mainSuitColor}" />
            <path d="M 32 125 L 50 155 L 68 125 Z" fill="#2471a3" stroke="url(#gold-grad-j)" stroke-width="1.5"/>
            
            <!-- Broche con el palo en el pecho -->
            <circle cx="50" cy="145" r="9" fill="#ffffff" stroke="url(#gold-grad-j)" stroke-width="1.5"/>
            <text x="50" y="149" font-size="12" font-weight="bold" fill="${mainSuitColor}" text-anchor="middle" dominant-baseline="middle">${suitSymbol}</text>
            
            <!-- Gorguera / Cuello de encaje -->
            <path d="M 28 115 Q 50 128 72 115 Q 50 110 28 115 Z" fill="#ffffff" stroke="#d5dbdb" stroke-width="1"/>
            
            <!-- Cuello y Rostro -->
            <rect x="42" y="100" width="16" height="18" fill="#fdebd0" />
            <ellipse cx="50" cy="85" rx="19" ry="24" fill="#fdebd0" stroke="#eb984e" stroke-width="0.8"/>
            
            <!-- Cabello rizado -->
            <path d="M 30 75 Q 26 95 32 110 Q 35 90 35 75 Z" fill="#b9770e"/>
            <path d="M 70 75 Q 74 95 68 110 Q 65 90 65 75 Z" fill="#b9770e"/>
            
            <!-- Rasgos faciales (Mirada altiva de la Sota) -->
            <!-- Ojos -->
            <ellipse cx="42" cy="82" rx="3" ry="1.8" fill="#ffffff"/>
            <circle cx="43" cy="82" r="1.3" fill="#1b2631"/>
            <path d="M 39 78 Q 43 76 46 78" fill="none" stroke="#784212" stroke-width="1.2"/>
            
            <ellipse cx="58" cy="82" rx="3" ry="1.8" fill="#ffffff"/>
            <circle cx="57" cy="82" r="1.3" fill="#1b2631"/>
            <path d="M 54 78 Q 57 76 61 78" fill="none" stroke="#784212" stroke-width="1.2"/>
            
            <!-- Nariz y Boca -->
            <path d="M 50 83 L 48 91 L 52 91" fill="none" stroke="#d35400" stroke-width="1"/>
            <path d="M 45 98 Q 50 102 55 98" fill="none" stroke="#c0392b" stroke-width="1.6"/>
            
            <!-- Boina renacentista con pluma -->
            <path d="M 25 70 Q 50 50 75 70 Q 50 62 25 70 Z" fill="#1b4f72" stroke="url(#gold-grad-j)" stroke-width="1.5"/>
            <!-- Pluma ondeante -->
            <path d="M 30 65 Q 15 35 40 18 Q 30 35 38 60 Z" fill="#f4d03f" stroke="#b7950b" stroke-width="1"/>
            <circle cx="34" cy="64" r="3.5" fill="${mainSuitColor}"/>

            <!-- Letra decorativa J -->
            <text x="14" y="24" font-size="14" font-weight="900" font-family="'Segoe UI', sans-serif" fill="url(#gold-grad-j)">J</text>
            <text x="86" y="180" font-size="14" font-weight="900" font-family="'Segoe UI', sans-serif" fill="url(#gold-grad-j)" text-anchor="end">J</text>
        </svg>`;
    } else if (value === 'Q') {
        // Queen / Reina: Corona de joyas, velo real y flor en mano
        return `
        <svg class="face-art-svg" viewBox="0 0 100 190" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="gold-grad-q" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#fef9e7" />
                    <stop offset="50%" stop-color="#f1c40f" />
                    <stop offset="100%" stop-color="#b7950b" />
                </linearGradient>
            </defs>
            <!-- Marco ornamental -->
            <rect x="2" y="2" width="96" height="186" rx="4" fill="#faf8f5" stroke="url(#gold-grad-q)" stroke-width="2.5"/>
            <rect x="6" y="6" width="88" height="178" rx="2" fill="none" stroke="${mainSuitColor}" stroke-width="0.8" opacity="0.6"/>
            
            <!-- Velo real que cae por detrás -->
            <path d="M 22 55 Q 12 120 18 184 L 82 184 Q 88 120 78 55 Z" fill="#eaeded" opacity="0.75"/>
            
            <!-- Vestido y manto real -->
            <path d="M 16 184 L 25 125 L 75 125 L 84 184 Z" fill="${mainSuitColor}" />
            <path d="M 34 125 L 50 150 L 66 125 Z" fill="#6c3483" stroke="url(#gold-grad-q)" stroke-width="1.2"/>
            
            <!-- Collar de perlas y gema central -->
            <path d="M 36 120 Q 50 132 64 120" fill="none" stroke="url(#gold-grad-q)" stroke-width="2" stroke-dasharray="2.5,2"/>
            <circle cx="50" cy="128" r="4" fill="${mainSuitColor}" stroke="url(#gold-grad-q)" stroke-width="1"/>

            <!-- Cuello y Rostro femenino -->
            <rect x="44" y="98" width="12" height="18" fill="#fdebd0" />
            <ellipse cx="50" cy="85" rx="17" ry="22" fill="#fdebd0" stroke="#eb984e" stroke-width="0.7"/>
            
            <!-- Cabello elegante con ondas -->
            <path d="M 32 78 Q 28 100 35 116 Q 38 95 38 78 Z" fill="#935116"/>
            <path d="M 68 78 Q 72 100 65 116 Q 62 95 62 78 Z" fill="#935116"/>
            <ellipse cx="50" cy="72" rx="18" ry="7" fill="#935116"/>

            <!-- Rasgos delicados de la Reina -->
            <!-- Ojos -->
            <ellipse cx="43" cy="83" rx="2.8" ry="1.6" fill="#ffffff"/>
            <circle cx="43" cy="83" r="1.2" fill="#1b2631"/>
            <path d="M 39 79 Q 43 77 47 80" fill="none" stroke="#784212" stroke-width="1.1"/>
            
            <ellipse cx="57" cy="83" rx="2.8" ry="1.6" fill="#ffffff"/>
            <circle cx="57" cy="83" r="1.2" fill="#1b2631"/>
            <path d="M 53 80 Q 57 77 61 79" fill="none" stroke="#784212" stroke-width="1.1"/>

            <!-- Nariz y Labios carmesí -->
            <path d="M 50 84 L 48 91 L 52 91" fill="none" stroke="#d35400" stroke-width="0.9"/>
            <path d="M 45 97 Q 50 101 55 97" fill="#e74c3c" stroke="#c0392b" stroke-width="0.8"/>
            
            <!-- Corona de la Reina -->
            <path d="M 31 70 L 33 50 L 41 62 L 50 44 L 59 62 L 67 50 L 69 70 Z" fill="url(#gold-grad-q)" stroke="#b7950b" stroke-width="1.2"/>
            <!-- Gemas en la corona -->
            <circle cx="50" cy="52" r="2.5" fill="${mainSuitColor}"/>
            <circle cx="37" cy="58" r="2" fill="#2980b9"/>
            <circle cx="63" cy="58" r="2" fill="#2980b9"/>
            
            <!-- Flor / Cetro sostenido con el símbolo del palo -->
            <g transform="translate(68, 140)">
                <circle cx="10" cy="10" r="10" fill="#ffffff" stroke="url(#gold-grad-q)" stroke-width="1.5"/>
                <text x="10" y="14" font-size="13" font-weight="bold" fill="${mainSuitColor}" text-anchor="middle" dominant-baseline="middle">${suitSymbol}</text>
            </g>

            <!-- Letra decorativa Q -->
            <text x="14" y="24" font-size="14" font-weight="900" font-family="'Segoe UI', sans-serif" fill="url(#gold-grad-q)">Q</text>
            <text x="86" y="180" font-size="14" font-weight="900" font-family="'Segoe UI', sans-serif" fill="url(#gold-grad-q)" text-anchor="end">Q</text>
        </svg>`;
    } else if (value === 'K') {
        // King / Rey: Corona imperial alta, barba señorial, manto de armiño y espada
        return `
        <svg class="face-art-svg" viewBox="0 0 100 190" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="gold-grad-k" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#fff4a3" />
                    <stop offset="50%" stop-color="#f39c12" />
                    <stop offset="100%" stop-color="#9a7d0a" />
                </linearGradient>
            </defs>
            <!-- Marco ornamental -->
            <rect x="2" y="2" width="96" height="186" rx="4" fill="#faf8f5" stroke="url(#gold-grad-k)" stroke-width="2.5"/>
            <rect x="6" y="6" width="88" height="178" rx="2" fill="none" stroke="${mainSuitColor}" stroke-width="0.8" opacity="0.6"/>
            
            <!-- Manto real -->
            <path d="M 12 184 L 20 120 L 80 120 L 88 184 Z" fill="${mainSuitColor}" />
            
            <!-- Cuello de armiño blanco con motas -->
            <path d="M 20 120 Q 50 142 80 120 L 84 140 Q 50 162 16 140 Z" fill="#f8f9f9" stroke="#d5dbdb" stroke-width="1"/>
            <!-- Motas negras del armiño -->
            <circle cx="28" cy="132" r="1.5" fill="#17202a"/>
            <circle cx="42" cy="138" r="1.5" fill="#17202a"/>
            <circle cx="58" cy="138" r="1.5" fill="#17202a"/>
            <circle cx="72" cy="132" r="1.5" fill="#17202a"/>

            <!-- Espada imperial alzada -->
            <g transform="translate(14, 80)">
                <rect x="2" y="0" width="3" height="48" fill="#e5e7e9" stroke="#7f8c8d" stroke-width="0.8"/>
                <path d="M -2 40 L 9 40 L 9 43 L -2 43 Z" fill="url(#gold-grad-k)"/>
                <circle cx="3.5" cy="48" r="2.5" fill="url(#gold-grad-k)"/>
            </g>

            <!-- Cuello y Rostro -->
            <rect x="42" y="94" width="16" height="16" fill="#fdebd0" />
            <ellipse cx="50" cy="82" rx="18" ry="21" fill="#fdebd0" stroke="#eb984e" stroke-width="0.8"/>
            
            <!-- Barba y Bigote majestuosos -->
            <path d="M 36 84 Q 50 116 64 84 Q 50 96 36 84 Z" fill="#784212" stroke="#562b08" stroke-width="0.8"/>
            <path d="M 40 88 Q 50 95 60 88 Q 50 91 40 88 Z" fill="#562b08"/>

            <!-- Ojos majestuosos y cejas pobladas -->
            <ellipse cx="43" cy="78" rx="2.8" ry="1.7" fill="#ffffff"/>
            <circle cx="43" cy="78" r="1.3" fill="#1b2631"/>
            <path d="M 38 73 Q 43 71 47 74" fill="none" stroke="#562b08" stroke-width="1.8"/>
            
            <ellipse cx="57" cy="78" rx="2.8" ry="1.7" fill="#ffffff"/>
            <circle cx="57" cy="78" r="1.3" fill="#1b2631"/>
            <path d="M 53 74 Q 57 71 62 73" fill="none" stroke="#562b08" stroke-width="1.8"/>

            <!-- Nariz y Boca -->
            <path d="M 50 78 L 48 85 L 52 85" fill="none" stroke="#d35400" stroke-width="1.1"/>
            
            <!-- Gran Corona Imperial con cruz y gemas -->
            <path d="M 28 66 L 30 42 L 40 54 L 50 36 L 60 54 L 70 42 L 72 66 Z" fill="url(#gold-grad-k)" stroke="#9a7d0a" stroke-width="1.3"/>
            <path d="M 48 30 L 52 30 L 52 36 L 48 36 Z M 46 32 L 54 32" stroke="url(#gold-grad-k)" stroke-width="2" fill="none"/>
            <circle cx="50" cy="46" r="3" fill="${mainSuitColor}"/>
            <circle cx="36" cy="50" r="2" fill="#1abc9c"/>
            <circle cx="64" cy="50" r="2" fill="#1abc9c"/>

            <!-- Escudo con el símbolo del palo en el pecho -->
            <g transform="translate(62, 140)">
                <circle cx="10" cy="10" r="10" fill="#ffffff" stroke="url(#gold-grad-k)" stroke-width="1.5"/>
                <text x="10" y="14" font-size="13" font-weight="bold" fill="${mainSuitColor}" text-anchor="middle" dominant-baseline="middle">${suitSymbol}</text>
            </g>

            <!-- Letra decorativa K -->
            <text x="14" y="24" font-size="14" font-weight="900" font-family="'Segoe UI', sans-serif" fill="url(#gold-grad-k)">K</text>
            <text x="86" y="180" font-size="14" font-weight="900" font-family="'Segoe UI', sans-serif" fill="url(#gold-grad-k)" text-anchor="end">K</text>
        </svg>`;
    }
    return '';
}

function createCardElement(card) {
    const div = document.createElement('div');
    div.classList.add('card');

    if (!card.faceUp) {
        div.classList.add('back');
        return div;
    }

    div.classList.add(card.color);
    const suitSymbol = getSuitSymbol(card.suit);

    let centerHtml = '';
    if (card.value === 'J' || card.value === 'Q' || card.value === 'K') {
        centerHtml = getFaceCardSvg(card.value, card.suit, card.color);
    } else {
        centerHtml = getPipsHtml(card.value, suitSymbol);
    }

    div.innerHTML = `
        <div class="card-corner top-left">
            <span>${card.value}</span>
            <span>${suitSymbol}</span>
        </div>
        <div class="card-center">
            ${centerHtml}
        </div>
        <div class="card-corner bottom-right">
            <span>${card.value}</span>
            <span>${suitSymbol}</span>
        </div>
    `;

    // Resaltado si la carta está seleccionada
    if (isCardSelected(card)) {
        div.classList.add('selected');
    }

    return div;
}

function isCardSelected(card) {
    if (!selectedCards) return false;
    if (selectedCards.source === 'waste' && selectedCards.card === card) return true;
    if (selectedCards.source === 'foundation' && selectedCards.card === card) return true;
    if (selectedCards.source === 'tableau' && selectedCards.cards && selectedCards.cards.includes(card)) return true;
    return false;
}

// Comprueba si una subsecuencia de cartas en el Tableau es decreciente y de color alterno
function isValidSubStack(cards) {
    for (let i = 0; i < cards.length - 1; i++) {
        let current = cards[i];
        let next = cards[i + 1];
        if (current.color === next.color || current.numericValue !== next.numericValue + 1) {
            return false;
        }
    }
    return true;
}

// Valida si una carta puede colocarse sobre targetCard en el Tableau
function isValidTableauMove(card, targetCard) {
    if (!targetCard) {
        return card.value === 'K'; // En espacio vacío solo puede colocarse un Rey
    }
    return card.color !== targetCard.color && card.numericValue === targetCard.numericValue - 1;
}

// Valida si una carta puede colocarse en una fundación específica
function canPlaceOnFoundation(card, foundationIndex) {
    const requiredSuit = foundationSuits[foundationIndex];
    if (card.suit !== requiredSuit) {
        return false;
    }

    const pile = foundations[foundationIndex];
    if (pile.length === 0) {
        return card.value === 'A';
    }

    const topCard = pile[pile.length - 1];
    return card.numericValue === topCard.numericValue + 1;
}

// Manejadores de interacción por CLIC
function handleWasteClick() {
    let topWaste = waste[waste.length - 1];
    if (!topWaste) return;

    if (selectedCards && selectedCards.source === 'waste') {
        clearSelection();
    } else {
        selectedCards = { source: 'waste', card: topWaste };
        render();
    }
}

function handleFoundationClick(foundationIndex) {
    let pile = foundations[foundationIndex];
    let topCard = pile.length > 0 ? pile[pile.length - 1] : null;

    if (selectedCards) {
        let cardToMove = selectedCards.card || selectedCards.cards[0];
        let isSingleCard = !selectedCards.cards || selectedCards.cards.length === 1;

        if (isSingleCard && canPlaceOnFoundation(cardToMove, foundationIndex)) {
            executeMoveToFoundation(cardToMove, selectedCards, foundationIndex);
            clearSelection();
            return;
        }

        // Si no es un movimiento válido y se hizo clic en una carta de fundación, seleccionarla
        if (topCard) {
            selectedCards = { source: 'foundation', foundationIndex, card: topCard };
            render();
            return;
        }

        clearSelection();
    } else {
        // Seleccionar carta de la fundación para poder bajarla al Tableau
        if (topCard) {
            selectedCards = { source: 'foundation', foundationIndex, card: topCard };
            render();
        }
    }
}

function handleTableauCardClick(pileIndex, cardIndex) {
    let targetPile = tableau[pileIndex];

    if (selectedCards) {
        // Si hace clic en la misma carta que ya está seleccionada -> deseleccionar
        if (selectedCards.source === 'tableau' && selectedCards.pileIndex === pileIndex && selectedCards.cardIndex === cardIndex) {
            clearSelection();
            return;
        }

        // Si es la misma columna pero otra carta -> cambiar selección si es válida
        if (selectedCards.source === 'tableau' && selectedCards.pileIndex === pileIndex) {
            let cardsToMove = targetPile.slice(cardIndex);
            if (isValidSubStack(cardsToMove)) {
                selectedCards = { source: 'tableau', pileIndex, cardIndex, cards: cardsToMove };
                render();
            } else {
                clearSelection();
            }
            return;
        }

        // Intentar mover las cartas seleccionadas a esta columna
        let topTargetCard = targetPile[targetPile.length - 1];
        let movingCards = selectedCards.cards ? selectedCards.cards : [selectedCards.card];

        if (isValidTableauMove(movingCards[0], topTargetCard)) {
            executeMoveToTableau(movingCards, selectedCards, pileIndex);
            clearSelection();
            return;
        }

        // Si no es un movimiento válido pero la carta en la que hizo clic puede seleccionarse, cambiar selección
        let cardsToMove = targetPile.slice(cardIndex);
        if (isValidSubStack(cardsToMove)) {
            selectedCards = { source: 'tableau', pileIndex, cardIndex, cards: cardsToMove };
            render();
            return;
        }

        clearSelection();
    } else {
        // Seleccionar subpila de esta columna
        let cardsToMove = targetPile.slice(cardIndex);
        if (isValidSubStack(cardsToMove)) {
            selectedCards = { source: 'tableau', pileIndex, cardIndex, cards: cardsToMove };
            render();
        }
    }
}

function handleTableauPileClick(pileIndex) {
    if (!selectedCards) return;

    let targetPile = tableau[pileIndex];
    let topTargetCard = targetPile.length > 0 ? targetPile[targetPile.length - 1] : null;
    let movingCards = selectedCards.cards ? selectedCards.cards : [selectedCards.card];

    if (selectedCards.source === 'tableau' && selectedCards.pileIndex === pileIndex) {
        return; // Misma columna
    }

    if (isValidTableauMove(movingCards[0], topTargetCard)) {
        executeMoveToTableau(movingCards, selectedCards, pileIndex);
        clearSelection();
    }
}

// Manejadores de Drag and Drop
function handleFoundationDrop(targetFoundationIndex) {
    if (!draggedItem) return;

    let card = draggedItem.card || draggedItem.cards[0];
    let isSingleCard = !draggedItem.cards || draggedItem.cards.length === 1;

    if (isSingleCard && canPlaceOnFoundation(card, targetFoundationIndex)) {
        executeMoveToFoundation(card, draggedItem, targetFoundationIndex);
        draggedItem = null;
        clearSelection();
    }
}

function handleTableauDrop(targetPileIndex) {
    if (!draggedItem) return;

    if (draggedItem.source === 'tableau' && draggedItem.pileIndex === targetPileIndex) {
        draggedItem = null;
        return;
    }

    let targetPile = tableau[targetPileIndex];
    let topTargetCard = targetPile.length > 0 ? targetPile[targetPile.length - 1] : null;
    let movingCards = draggedItem.cards ? draggedItem.cards : [draggedItem.card];

    if (isValidTableauMove(movingCards[0], topTargetCard)) {
        executeMoveToTableau(movingCards, draggedItem, targetPileIndex);
        draggedItem = null;
        clearSelection();
    }
}

// Ejecución segura de movimientos
function executeMoveToFoundation(card, sourceItem, targetFoundationIndex) {
    if (sourceItem.source === 'waste') {
        waste.pop();
    } else if (sourceItem.source === 'tableau') {
        let pile = tableau[sourceItem.pileIndex];
        pile.pop();
        revealTopTableauCard(sourceItem.pileIndex);
    } else if (sourceItem.source === 'foundation') {
        const fIdx = (sourceItem.foundationIndex !== undefined) ? sourceItem.foundationIndex : sourceItem.pileIndex;
        foundations[fIdx].pop();
    }

    foundations[targetFoundationIndex].push(card);
}

function executeMoveToTableau(movingCards, sourceItem, targetPileIndex) {
    if (sourceItem.source === 'waste') {
        waste.pop();
    } else if (sourceItem.source === 'tableau') {
        tableau[sourceItem.pileIndex].splice(sourceItem.cardIndex, movingCards.length);
        revealTopTableauCard(sourceItem.pileIndex);
    } else if (sourceItem.source === 'foundation') {
        const fIdx = (sourceItem.foundationIndex !== undefined) ? sourceItem.foundationIndex : sourceItem.pileIndex;
        foundations[fIdx].pop();
    }

    tableau[targetPileIndex].push(...movingCards);
}

function revealTopTableauCard(pileIndex) {
    let pile = tableau[pileIndex];
    if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
        pile[pile.length - 1].faceUp = true;
    }
}

// Doble clic para auto-enviar a fundación válida
function tryAutoSendToFoundation(source, pileIndex = null, cardIndex = null) {
    let card = null;

    if (source === 'waste') {
        card = waste[waste.length - 1];
    } else if (source === 'tableau') {
        let pile = tableau[pileIndex];
        if (cardIndex !== pile.length - 1) return;
        card = pile[cardIndex];
    }

    if (!card) return;

    for (let i = 0; i < foundations.length; i++) {
        if (canPlaceOnFoundation(card, i)) {
            let sourceItem = { source, pileIndex, cardIndex, card };
            executeMoveToFoundation(card, sourceItem, i);
            clearSelection();
            break;
        }
    }
}

function clearSelection() {
    selectedCards = null;
    draggedItem = null;
    render();
}

function checkWinCondition() {
    let totalFoundations = foundations.reduce((sum, pile) => sum + pile.length, 0);
    if (totalFoundations === 104) {
        document.getElementById('message').textContent = '🎉 ¡Felicidades, ganaste la partida con el mazo doble!';
    }
}

document.getElementById('restart-btn').addEventListener('click', initGame);

// Iniciar al cargar
initGame();
