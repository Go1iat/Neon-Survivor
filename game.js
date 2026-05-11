const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const stick = document.getElementById('joystick-stick');
const base = document.getElementById('joystick-base');

function ajustarPantalla() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', ajustarPantalla);
ajustarPantalla();

// --- VARIABLES DE ESTADO ---
let jugador = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radio: 15,
    color: localStorage.getItem('skinEquipada') || '#38bdf8',
    velocidad: 5,
    vx: 0, vy: 0,
    vida: 100,
    nivel: 1,
    exp: 0,
    expSiguienteNivel: 10
};

let proyectiles = [];
let enemigos = [];
let notificaciones = [];
let frameCount = 0;
let bajas = 0;
let juegoActivo = true;
let monedas = localStorage.getItem('monedas') ? parseInt(localStorage.getItem('monedas')) : 0;

document.getElementById('contador-monedas').innerText = monedas;

// --- SISTEMA DE AUDIO ---
const sonidos = {
    disparo: new Audio('disparo.wav'),
    muerteDebil: new Audio('muerte1.wav'),
    muerteFuerte: new Audio('muerte2.wav'),
    levelUp: new Audio('levelup.wav'),
    gameOver: new Audio('gameover.wav')
};

function reproducir(sonido, volumen = 0.2) {
    const canal = sonido.cloneNode();
    canal.volume = volumen;
    canal.play().catch(() => {}); 
}

// --- CLASES ---
class Proyectil {
    constructor(x, y, vx, vy) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.radio = 4;
        this.color = '#facc15';
    }
    dibujar() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radio, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.closePath();
    }
    actualizar() {
        this.x += this.vx;
        this.y += this.vy;
    }
}

class Enemigo {
    constructor(x, y, tipo = 'normal') {
        this.x = x;
        this.y = y;
        this.tipo = tipo;
        if (tipo === 'fuerte') {
            this.radio = 20;
            this.color = '#a855f7';
            this.velocidad = 1.5;
            this.vida = 3 + Math.floor(jugador.nivel / 2); 
        } else {
            this.radio = 12;
            this.color = '#ff0055';
            this.velocidad = 2 + (jugador.nivel * 0.2);
            this.vida = 1;
        }
    }
    dibujar() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radio, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.closePath();
    }
    actualizar() {
        const dx = jugador.x - this.x;
        const dy = jugador.y - this.y;
        const distancia = Math.sqrt(dx * dx + dy * dy);
        this.x += (dx / distancia) * this.velocidad;
        this.y += (dy / distancia) * this.velocidad;
    }
}

class TextoFlotante {
    constructor(x, y, texto, color) {
        this.x = x; this.y = y;
        this.texto = texto;
        this.color = color;
        this.vida = 90; // Un poco más de duración
        this.opacidad = 1;
    }
    dibujar() {
        ctx.save();
        ctx.globalAlpha = this.opacidad;
        ctx.fillStyle = this.color;
        ctx.font = "bold 22px Arial";
        ctx.textAlign = "center";
        ctx.shadowBlur = 5;
        ctx.shadowColor = "black";
        ctx.fillText(this.texto, this.x, this.y);
        ctx.restore();
    }
    actualizar() {
        this.y -= 0.8;
        this.vida--;
        this.opacidad = this.vida / 90;
    }
}

// --- CONTROLES ---
const teclas = {};
let touchID = null;
window.addEventListener('keydown', (e) => { if(juegoActivo) teclas[e.code] = true; });
window.addEventListener('keyup', (e) => teclas[e.code] = false);

window.addEventListener('touchstart', (e) => {
    if(!juegoActivo) return;
    base.style.display = 'block';
    const touch = e.touches[0];
    base.style.left = (touch.clientX - 50) + 'px';
    base.style.top = (touch.clientY - 50) + 'px';
    touchID = touch.identifier;
});

window.addEventListener('touchmove', (e) => {
    if(!juegoActivo) return;
    e.preventDefault();
    const touch = Array.from(e.touches).find(t => t.identifier === touchID);
    if (!touch) return;
    const rect = base.getBoundingClientRect();
    const centroX = rect.left + 50; const centroY = rect.top + 50;
    let dx = touch.clientX - centroX; let dy = touch.clientY - centroY;
    const distancia = Math.sqrt(dx * dx + dy * dy);
    const maxLimit = 50;
    if (distancia > maxLimit) { dx *= maxLimit / distancia; dy *= maxLimit / distancia; }
    stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    jugador.vx = (dx / maxLimit) * jugador.velocidad;
    jugador.vy = (dy / maxLimit) * jugador.velocidad;
}, { passive: false });

window.addEventListener('touchend', () => {
    base.style.display = 'none';
    jugador.vx = 0; jugador.vy = 0;
    touchID = null;
});

// --- TIENDA ---
function abrirTienda() {
    document.getElementById('pantalla-game-over').style.display = 'none';
    document.getElementById('tienda-ui').style.display = 'block';
    document.getElementById('tienda-monedas').innerText = monedas;
}

function cerrarTienda() {
    document.getElementById('tienda-ui').style.display = 'none';
    document.getElementById('pantalla-game-over').style.display = 'flex';
}

function comprarSkin(color, precio) {
    if (monedas >= precio) {
        if (jugador.color !== color) {
            monedas -= precio;
            localStorage.setItem('monedas', monedas);
            localStorage.setItem('skinEquipada', color);
            jugador.color = color;
            document.getElementById('tienda-monedas').innerText = monedas;
            document.getElementById('contador-monedas').innerText = monedas;
            
            // NOTIFICACIÓN DE SKIN EQUIPADA
            notificaciones.push(new TextoFlotante(jugador.x, jugador.y - 40, "¡SKIN EQUIPADA!", color));
            reproducir(sonidos.levelUp, 0.3);
        }
    } else {
        alert("¡Monedas insuficientes!");
    }
}

// --- LÓGICA ---
function spawnEnemigos() {
    if(!juegoActivo) return;
    let frecuencia = Math.max(10, 60 - (jugador.nivel * 5)); 
    if (frameCount % frecuencia === 0) {
        for(let i = 0; i < Math.min(jugador.nivel, 5); i++) {
            let x, y;
            if (Math.random() < 0.5) {
                x = Math.random() < 0.5 ? -30 : canvas.width + 30;
                y = Math.random() * canvas.height;
            } else {
                x = Math.random() * canvas.width;
                y = Math.random() < 0.5 ? -30 : canvas.height + 30;
            }
            let tipo = (Math.random() < 0.1 * jugador.nivel) ? 'fuerte' : 'normal';
            enemigos.push(new Enemigo(x, y, tipo));
        }
    }
}

function dispararAutomatico() {
    if(!juegoActivo) return;
    let cadencia = Math.max(3, 20 - (jugador.nivel * 2));
    if (enemigos.length > 0 && frameCount % cadencia === 0) {
        let cantidadBalas = Math.min(3, Math.ceil(jugador.nivel / 2));
        reproducir(sonidos.disparo, 0.15);
        for (let i = 0; i < cantidadBalas; i++) {
            const objetivo = enemigos[i % enemigos.length]; 
            const dx = objetivo.x - jugador.x;
            const dy = objetivo.y - jugador.y;
            const distancia = Math.sqrt(dx * dx + dy * dy);
            const dispersion = (i - (cantidadBalas - 1) / 2) * 0.2;
            const vx = (dx / distancia) * 12;
            const vy = (dy / distancia) * 12;
            const finalVx = vx * Math.cos(dispersion) - vy * Math.sin(dispersion);
            const finalVy = vx * Math.sin(dispersion) + vy * Math.cos(dispersion);
            proyectiles.push(new Proyectil(jugador.x, jugador.y, finalVx, finalVy));
        }
    }
}

function subirDeNivel() {
    if (jugador.exp >= jugador.expSiguienteNivel) {
        jugador.nivel++;
        jugador.exp = 0;
        jugador.expSiguienteNivel += 15;
        jugador.velocidad += 0.3;
        jugador.vida = Math.min(100, jugador.vida + 20);
        
        reproducir(sonidos.levelUp, 0.4);

        // --- NOTIFICACIONES DE NIVEL RESTAURADAS ---
        notificaciones.push(new TextoFlotante(jugador.x, jugador.y - 30, "¡LEVEL UP!", "#4ade80"));
        notificaciones.push(new TextoFlotante(jugador.x, jugador.y - 55, "+20 VIDA", "#38bdf8"));

        if (jugador.nivel === 3) {
            notificaciones.push(new TextoFlotante(jugador.x, jugador.y - 80, "¡DISPARO DOBLE!", "#facc15"));
        } else if (jugador.nivel === 5) {
            notificaciones.push(new TextoFlotante(jugador.x, jugador.y - 80, "¡DISPARO TRIPLE!", "#facc15"));
        }

        document.getElementById('nivel').innerText = jugador.nivel;
        actualizarBarraVida();
    }
}

function actualizarBarraVida() {
    const barra = document.getElementById('vida-lleno');
    if(barra) barra.style.width = jugador.vida + '%';
}

let animacionID;

function actualizar() {
    if (!juegoActivo) return;
    frameCount++;
    if (Object.values(teclas).includes(true)) {
        if (teclas['KeyW'] || teclas['ArrowUp']) jugador.y -= jugador.velocidad;
        if (teclas['KeyS'] || teclas['ArrowDown']) jugador.y += jugador.velocidad;
        if (teclas['KeyA'] || teclas['ArrowLeft']) jugador.x -= jugador.velocidad;
        if (teclas['KeyD'] || teclas['ArrowRight']) jugador.x += jugador.velocidad;
    } else {
        jugador.x += jugador.vx; jugador.y += jugador.vy;
    }
    jugador.x = Math.max(jugador.radio, Math.min(canvas.width - jugador.radio, jugador.x));
    jugador.y = Math.max(jugador.radio, Math.min(canvas.height - jugador.radio, jugador.y));
    spawnEnemigos();
    dispararAutomatico();
    subirDeNivel();
}

function dibujar() {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Jugador
    ctx.beginPath();
    ctx.arc(jugador.x, jugador.y, jugador.radio, 0, Math.PI * 2);
    ctx.fillStyle = jugador.color;
    ctx.shadowBlur = 20; ctx.shadowColor = jugador.color;
    ctx.fill(); ctx.closePath(); ctx.shadowBlur = 0;

    // Balas
    proyectiles.forEach((p, pIndex) => {
        p.actualizar(); p.dibujar();
        if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) proyectiles.splice(pIndex, 1);
    });

    // Enemigos
    enemigos.forEach((e, eIndex) => {
        if(juegoActivo) e.actualizar(); 
        e.dibujar();

        proyectiles.forEach((p, pIndex) => {
            const dist = Math.sqrt((p.x - e.x)**2 + (p.y - e.y)**2);
            if (dist < p.radio + e.radio) {
                e.vida -= 1;
                proyectiles.splice(pIndex, 1);
                if (e.vida <= 0) {
                    monedas += (e.tipo === 'fuerte') ? 5 : 1;
                    localStorage.setItem('monedas', monedas);
                    document.getElementById('contador-monedas').innerText = monedas;
                    
                    if(e.tipo === 'fuerte') reproducir(sonidos.muerteFuerte, 0.3);
                    else reproducir(sonidos.muerteDebil, 0.2);

                    enemigos.splice(eIndex, 1);
                    bajas++;
                    jugador.exp++;
                    document.getElementById('bajas').innerText = bajas;
                }
            }
        });

        const distJugador = Math.sqrt((jugador.x - e.x)**2 + (jugador.y - e.y)**2);
        if (distJugador < jugador.radio + e.radio && juegoActivo) {
            jugador.vida -= 0.5;
            actualizarBarraVida();
            if (jugador.vida <= 0) {
                juegoActivo = false;
                reproducir(sonidos.gameOver, 0.5);
                document.getElementById('final-nivel').innerText = jugador.nivel;
                document.getElementById('final-bajas').innerText = bajas;
                document.getElementById('pantalla-game-over').style.display = 'flex';
                cancelAnimationFrame(animacionID);
            }
        }
    });

    // Dibujar textos flotantes (notificaciones)
    notificaciones.forEach((n, index) => {
        n.actualizar(); n.dibujar();
        if (n.vida <= 0) notificaciones.splice(index, 1);
    });

    actualizar();
    animacionID = requestAnimationFrame(dibujar);
}

dibujar();