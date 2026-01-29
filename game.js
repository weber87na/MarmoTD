
// --- Constants & Config ---

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const TILE_SIZE = 40;
const FPS = 90; // Increased from 60 to 90 (1.5x Speed)

const ELEMENTS = {
    NONE: '無',
    LIGHT: '光',
    DARK: '暗',
    WATER: '水',
    FIRE: '火',
    WIND: '風',
    EARTH: '土',
    POISON: '毒'
};

const ELEMENT_COLORS = {
    '無': '#B0BEC5',
    '光': '#FFF59D',
    '暗': '#7B1FA2',
    '水': '#29B6F6',
    '火': '#EF5350',
    '風': '#26A69A',
    '土': '#8D6E63',
    '毒': '#C6FF00'
};

// Attack Multipliers: attacker -> defender
const ELEMENT_CHART = {
    // Water > Fire > Wind > Earth > Water
    // Light <> Dark
    // Poison > Earth/Water, Poison < Fire/Wind/Light
    // None is neutral
};

// Initialize Chart
for (let k in ELEMENTS) ELEMENT_CHART[ELEMENTS[k]] = {};

function setRel(atk, def, val) { 
    if (ELEMENT_CHART[atk]) {
        ELEMENT_CHART[atk][def] = val; 
    }
}

// Defaults 1.0
Object.values(ELEMENTS).forEach(a => Object.values(ELEMENTS).forEach(d => setRel(a, d, 1.0)));

// Cycle
setRel(ELEMENTS.WATER, ELEMENTS.FIRE, 2.0);
setRel(ELEMENTS.FIRE, ELEMENTS.WATER, 0.5);

setRel(ELEMENTS.FIRE, ELEMENTS.WIND, 2.0);
setRel(ELEMENTS.WIND, ELEMENTS.FIRE, 0.5);

setRel(ELEMENTS.WIND, ELEMENTS.EARTH, 2.0);
setRel(ELEMENTS.EARTH, ELEMENTS.WIND, 0.5);

setRel(ELEMENTS.EARTH, ELEMENTS.WATER, 2.0);
setRel(ELEMENTS.WATER, ELEMENTS.EARTH, 0.5);

// Light / Dark
setRel(ELEMENTS.LIGHT, ELEMENTS.DARK, 2.0);
setRel(ELEMENTS.DARK, ELEMENTS.LIGHT, 2.0);
setRel(ELEMENTS.LIGHT, ELEMENTS.LIGHT, 0.5);
setRel(ELEMENTS.DARK, ELEMENTS.DARK, 0.5);

// Poison Logic
setRel(ELEMENTS.POISON, ELEMENTS.EARTH, 1.5);
setRel(ELEMENTS.POISON, ELEMENTS.WATER, 1.5);
setRel(ELEMENTS.POISON, ELEMENTS.POISON, 0.0); // Immune
setRel(ELEMENTS.FIRE, ELEMENTS.POISON, 1.5); // Burn poison
setRel(ELEMENTS.WIND, ELEMENTS.POISON, 1.5); // Disperse poison

// Path Definition (Grid Coordinates)
// S-Shape
const PATH_POINTS = [
    {x: 0, y: 2},
    {x: 18, y: 2},
    {x: 18, y: 6},
    {x: 1, y: 6},
    {x: 1, y: 10},
    {x: 18, y: 10},
    {x: 18, y: 14}, // End
];

// --- Global State ---

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const assets = { marmot: new Image() };
assets.marmot.src = 'https://raw.githubusercontent.com/weber87na/flowers/refs/heads/master/marmot.png';

let game = {
    gold: 600,
    lives: 20,
    wave: 1,
    score: 0,
    speedFactor: 1,
    loopId: null,
    lastTime: 0,
    enemies: [],
    towers: [],
    projectiles: [],
    particles: [],
    waveActive: false,
    waveTimer: 0,
    enemiesToSpawn: 0,
    spawnTimer: 0,
    selectedTower: null, // For UI
    mouseX: 0,
    mouseY: 0,
    autoNextWaveTimer: 0, // Auto start timer
    isGameStarted: false
};

// --- Generators ---

// Generate 20 Tower Types
const TOWER_TYPES = [];
const SHAPES = ['circle', 'square', 'triangle', 'pentagon', 'diamond'];
const ELEMENT_KEYS_ORIGINAL = ['NONE', 'LIGHT', 'DARK', 'WATER', 'FIRE', 'WIND', 'EARTH', 'POISON'];

// Custom Tower Names based on ID/Element
const TOWER_NAMES = [
    // Tier 1 (0-7)
    '鐵甲弩砲',   // NONE
    '光輝守衛',   // LIGHT
    '暗影射手',   // DARK
    '寒冰水晶',   // WATER
    '烈焰砲塔',   // FIRE
    '疾風圖騰',   // WIND
    '堅石堡壘',   // EARTH
    '劇毒噴嘴',   // POISON

    // Tier 2 (8-15)
    '重型加農',   // NONE (Cycle back)
    '天堂之拳',   // LIGHT
    '虛空行者',   // DARK
    '深海巨獸',   // WATER
    '隕石術塔',   // FIRE
    '雷神之錘',   // WIND
    '泰坦之握',   // EARTH
    '腐蝕之沼',   // POISON

    // Tier 3 (16-19)
    '毀滅戰車',   // NONE
    '神聖新星',   // LIGHT
    '狙擊精英',   // DARK (Sniper - ID 18)
    '狂暴機槍'    // WATER (Rapid - ID 19)
];

for (let i = 0; i < 20; i++) {
    const elementKey = ELEMENT_KEYS_ORIGINAL[i % 8];
    const element = ELEMENTS[elementKey];
    const tier = Math.floor(i / 8) + 1; // 1, 2, 3 roughly
    
    // Vary stats based on index to create "classes"
    let range = 3 + (i % 5); // 3 to 7 tiles
    let damage = 10 + (i * 2) + (tier * 5);
    let speed = 60 - (i % 3) * 10; // Frames per shot (lower is faster)
    if (speed < 10) speed = 10;
    let cost = 50 + (i * 25);

    // Special types adjustments
    if (i === 18) { // Sniper
        range = 12; damage = 300; speed = 120; cost = 800;
    }
    if (i === 19) { // Rapid
        range = 4; damage = 5; speed = 5; cost = 600;
    }

    let skill = null;
    let skillDesc = '';
    
    // Assign Skills based on Index/Element
    // 0 Light -> Heal
    if (i === 0 || i === 8) { skill = 'heal'; skillDesc = '治療周圍'; }
    // 2 Water -> Slow (Passive)
    else if (element === ELEMENTS.WATER) { skill = 'slow'; skillDesc = '緩速敵人'; }
    // 3 Fire -> Crit (Passive)
    else if (element === ELEMENTS.FIRE) { skill = 'crit'; skillDesc = '暴擊機率'; }
    // 6 Earth -> Gold (Passive)
    else if (element === ELEMENTS.EARTH) { skill = 'gold'; skillDesc = '生產黃金'; }
    // 7 Poison -> Poison (Passive)
    else if (element === ELEMENTS.POISON) { skill = 'poison'; skillDesc = '毒素傷害'; }
    // 18 Sniper -> Nuke (Active)
    else if (i === 18) { skill = 'nuke'; skillDesc = '主動: 核彈'; }

    TOWER_TYPES.push({
        id: i,
        name: TOWER_NAMES[i] || `${element}塔 MK${tier}`, // Use Custom Name
        element: element,
        range: range * TILE_SIZE,
        damage: damage,
        cooldown: speed,
        cost: cost,
        color: ELEMENT_COLORS[element],
        shape: SHAPES[i % SHAPES.length],
        tier: tier,
        skill: skill,
        skillDesc: skillDesc
    });
}

// Generate 100 Waves - HARDCORE
const WAVES = [];
for (let i = 0; i < 100; i++) {
    const isBoss = (i + 1) % 5 === 0;
    const elementKey = ELEMENT_KEYS_ORIGINAL[(i + 2) % 8];
    const element = ELEMENTS[elementKey];
    // Significantly increased HP scaling
    const baseHP = 150 * Math.pow(1.15, i); // Lowered slightly for 100 levels to prevent infinity
    const count = isBoss ? 3 : (10 + Math.floor(i / 2));
    const speed = 1.0 + (i % 3) * 0.5;
    
    WAVES.push({
        level: i + 1,
        elementKey: elementKey,
        element: element,
        count: count,
        hp: Math.floor(baseHP * (isBoss ? 10 : 1)), // Boss has 10x HP
        speed: isBoss ? speed * 0.5 : speed, // Boss is slower
        interval: isBoss ? 120 : (60 - Math.min(i, 40)),
        reward: (10 + Math.floor(i * 1.5)) * (isBoss ? 10 : 1),
        scale: (0.6 + (i % 4) * 0.1) * (isBoss ? 2.5 : 1), // Boss is huge
        isBoss: isBoss
    });
}
// --- Classes ---

class Enemy {
    constructor(waveIdx) {
        const config = WAVES[waveIdx];
        this.hp = config.hp;
        this.maxHp = config.hp;
        this.speed = config.speed;
        this.element = config.element;
        this.reward = config.reward;
        this.scale = config.scale;
        this.isBoss = config.isBoss;
        
        // Pathing
        this.pathIndex = 0;
        this.x = PATH_POINTS[0].x * TILE_SIZE + TILE_SIZE/2;
        this.y = PATH_POINTS[0].y * TILE_SIZE + TILE_SIZE/2;
        this.targetX = PATH_POINTS[1].x * TILE_SIZE + TILE_SIZE/2;
        this.targetY = PATH_POINTS[1].y * TILE_SIZE + TILE_SIZE/2;
        
        this.frozen = 0;
        this.poisoned = 0;
        this.poisonTimer = 0;
        
        this.attackCooldown = 0;
    }

    update() {
        // Status Effects
        let currentSpeed = this.speed * game.speedFactor;
        if (this.frozen > 0) {
            currentSpeed *= 0.5;
            this.frozen--;
        }
        
        // Regen
        if (this.hp < this.maxHp && Math.random() < 0.01) {
             this.hp += this.maxHp * 0.005;
             if(this.hp > this.maxHp) this.hp = this.maxHp;
        }

        if (this.poisoned > 0) {
            if (this.poisonTimer % 60 === 0) {
                this.hp -= this.poisoned; // damage per second
                game.particles.push(new TextParticle(this.x, this.y, `-${this.poisoned}`, '#76FF03'));
            }
            this.poisonTimer++;
            if (this.hp <= 0) this.die();
        }

        // Attack Nearby Towers (Some enemies)
        // Check for tower in range (e.g., 2 tiles)
        if (this.attackCooldown > 0) this.attackCooldown -= game.speedFactor;
        
        // Simple Logic: If a tower is very close, attack it instead of moving full speed?
        // Or attack while moving. Let's attack while moving.
        if (this.attackCooldown <= 0) {
            const nearbyTower = game.towers.find(t => {
                const dx = t.x - this.x;
                const dy = t.y - this.y;
                return Math.sqrt(dx*dx + dy*dy) < TILE_SIZE * 2;
            });
            
            if (nearbyTower) {
                // Attack!
                nearbyTower.takeDamage(10 * (this.isBoss ? 5 : 1)); // Boss hits hard
                game.projectiles.push(new Projectile(this.x, this.y, nearbyTower, 0, this.element, 5)); // Visual only
                this.attackCooldown = 60; // 1 sec attack rate
            }
        }

        // Movement
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist <= currentSpeed) {
            this.x = this.targetX;
            this.y = this.targetY;
            this.pathIndex++;
            if (this.pathIndex >= PATH_POINTS.length - 1) {
                this.reachEnd();
            } else {
                this.targetX = PATH_POINTS[this.pathIndex + 1].x * TILE_SIZE + TILE_SIZE/2;
                this.targetY = PATH_POINTS[this.pathIndex + 1].y * TILE_SIZE + TILE_SIZE/2;
            }
        } else {
            this.x += (dx / dist) * currentSpeed;
            this.y += (dy / dist) * currentSpeed;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Health Bar
        const pct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = 'red';
        ctx.fillRect(-15, -25, 30, 4);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(-15, -25, 30 * pct, 4);

        // Marmot
        const size = 32 * this.scale;
        
        // Elemental Aura / Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = ELEMENT_COLORS[this.element];
        ctx.strokeStyle = ctx.shadowColor;
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.arc(0, 0, size/1.5, 0, Math.PI*2);
        ctx.stroke();
        
        ctx.shadowBlur = 0; // Reset

        // Boss Indicator
        if (this.isBoss) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 5; // Thicker for boss
            ctx.stroke();
        }

        // Draw Image
        if (assets.marmot.complete) {
            ctx.drawImage(assets.marmot, -size/2, -size/2, size, size);
        }

        ctx.restore();
    }
// ... (rest of class)

    takeDamage(amount, type) {
        const mult = ELEMENT_CHART[type][this.element] || 1.0;
        const finalDmg = amount * mult;
        this.hp -= finalDmg;
        
        // Visual text
        let color = '#fff';
        if (mult > 1.2) color = '#ff0000'; // Crit
        else if (mult < 0.8) color = '#888'; // Weak
        
        if (game.particles.length < 50) { // Limit particles
            game.particles.push(new TextParticle(this.x, this.y - 10, Math.floor(finalDmg), color));
        }

        if (this.hp <= 0) this.die();
    }

    die() {
        this.dead = true;
        game.gold += this.reward;
        game.score += this.reward * 10;
        updateUI();
    }

    reachEnd() {
        this.dead = true;
        game.lives--;
        updateUI();
        if (game.lives <= 0) gameOver();
    }
}

class Tower {
    constructor(typeId, x, y) {
        const type = TOWER_TYPES[typeId];
        this.typeId = typeId;
        this.gridX = x;
        this.gridY = y;
        this.x = x * TILE_SIZE + TILE_SIZE/2;
        this.y = y * TILE_SIZE + TILE_SIZE/2;
        
        this.level = 1;
        this.spent = type.cost;
        this.kills = 0;
        
        // Stats
        this.baseDamage = type.damage;
        this.baseRange = type.range;
        this.baseCooldown = type.cooldown;
        this.element = type.element;
        this.shape = type.shape;
        this.color = type.color;
        this.skill = type.skill;
        
        this.cooldownTimer = 0;
        this.skillTimer = 0; // For passive skills
        this.activeSkillCd = 0; // For active skills

        // Health Logic
        this.maxHp = 100 * type.tier;
        this.hp = this.maxHp;
        this.dead = false;
    }

    getDamage() { return Math.floor(this.baseDamage * Math.pow(1.5, this.level - 1)); }
    
    // Sell Value depends on HP
    getCost() { 
        const baseSell = Math.floor(this.spent * 0.7);
        const hpPct = this.hp / this.maxHp;
        return Math.floor(baseSell * hpPct);
    }
    
    getUpgradeCost() { return Math.floor(TOWER_TYPES[this.typeId].cost * Math.pow(1.5, this.level)); }

    takeDamage(amount) {
        this.hp -= amount;
        game.particles.push(new TextParticle(this.x, this.y - 20, `-${amount}`, '#ff0000'));
        if (this.hp <= 0) {
            this.dead = true;
            game.selectedTower = null; // Deselect if selected
            document.getElementById('selection-info').style.display = 'none';
        }
    }
    
    heal(amount) {
        this.hp += amount;
        if (this.hp > this.maxHp) this.hp = this.maxHp;
        game.particles.push(new TextParticle(this.x, this.y - 20, `+${amount}`, '#00ff00'));
    }

    triggerActiveSkill() {
        if (this.skill === 'nuke' && this.activeSkillCd <= 0) {
             // Find strongest enemy
             let target = null;
             let maxHp = -1;
             for (const enemy of game.enemies) {
                 if (enemy.hp > maxHp) {
                     maxHp = enemy.hp;
                     target = enemy;
                 }
             }
             
             if (target) {
                 target.takeDamage(500 * this.level, this.element); // Massive Damage
                 game.particles.push(new TextParticle(target.x, target.y - 30, "核彈!", '#ff00ff'));
                 // Visual beam
                 game.projectiles.push(new Projectile(this.x, this.y, target, 0, this.element, 20)); 
                 this.activeSkillCd = 600; // 10s cooldown
                 updateTowerInfo(); // Update button state
                 return true;
             } else {
                 showNotification("沒有可攻擊的目標!");
                 return false;
             }
        }
        return false;
    }

    update() {
        if (this.dead) return;
        
        // Passive Regen
        if (this.hp < this.maxHp && Math.random() < 0.01) this.hp++;
        
        // Active Skill CD
        if (this.activeSkillCd > 0) {
             this.activeSkillCd -= game.speedFactor;
             if (this.activeSkillCd < 0) this.activeSkillCd = 0;
             if (game.selectedTower === this && this.activeSkillCd === 0) updateTowerInfo();
        }

        // Passive Skills Logic
        this.skillTimer += game.speedFactor;
        
        if (this.skill === 'gold' && this.skillTimer >= 300) { // 5s
            game.gold += 10;
            game.particles.push(new TextParticle(this.x, this.y - 20, `+$10`, '#ffd700'));
            this.skillTimer = 0;
            updateUI();
        }
        
        if (this.skill === 'heal' && this.skillTimer >= 60) { // 1s
            // Find damaged neighbor
            const neighbor = game.towers.find(t => t !== this && !t.dead && t.hp < t.maxHp && 
                Math.sqrt((t.x-this.x)**2 + (t.y-this.y)**2) <= TILE_SIZE * 3);
            
            if (neighbor) {
                neighbor.heal(5 * this.level);
                // Visual line?
            }
            this.skillTimer = 0;
        }

        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= game.speedFactor;
            return;
        }

        // Find Target
        // Simple logic: First enemy in range
        let target = null;
        let maxDist = 0; // Progress

        for (const enemy of game.enemies) {
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist <= this.baseRange) {
                target = enemy;
                break; 
            }
        }

        if (target) {
            this.shoot(target);
            this.cooldownTimer = this.baseCooldown;
        }
    }

    shoot(target) {
        let dmg = this.getDamage();
        let isCrit = false;
        
        if (this.skill === 'crit' && Math.random() < 0.25) { // 25% Crit
            dmg *= 2;
            isCrit = true;
        }

        game.projectiles.push(new Projectile(
            this.x, this.y, target, dmg, this.element, 8, isCrit, this.skill
        ));
    }

    draw() {
        const cx = this.x;
        const cy = this.y;
        
        ctx.fillStyle = '#222';
        ctx.fillRect(this.gridX * TILE_SIZE, this.gridY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        
        ctx.save();
        ctx.translate(cx, cy);
        
        // Base
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        if (this.shape === 'circle') ctx.arc(0,0, 15, 0, Math.PI*2);
        else if (this.shape === 'square') ctx.rect(-12,-12, 24, 24);
        else if (this.shape === 'triangle') {
            ctx.moveTo(0, -15); ctx.lineTo(12, 10); ctx.lineTo(-12, 10); ctx.closePath();
        } else {
            ctx.rect(-10,-10, 20, 20); // Default
        }
        ctx.fill();
        ctx.stroke();

        // Level Indicators
        ctx.fillStyle = 'gold';
        for(let i=0; i<this.level; i++) {
            ctx.fillRect(-10 + (i*4), -5, 2, 10);
        }

        // HP Bar (if damaged)
        if (this.hp < this.maxHp) {
            const pct = Math.max(0, this.hp / this.maxHp);
            ctx.fillStyle = 'red';
            ctx.fillRect(-15, 15, 30, 4);
            ctx.fillStyle = '#0f0';
            ctx.fillRect(-15, 15, 30 * pct, 4);
        }

        ctx.restore();
    }
}

class Projectile {
    constructor(x, y, target, damage, element, speed, isCrit = false, skillEffect = null) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.element = element;
        this.speed = speed;
        this.isCrit = isCrit;
        this.skillEffect = skillEffect;
        this.dead = false;
    }

    update() {
        if (this.target.dead) {
            this.dead = true;
            return;
        }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const move = this.speed * game.speedFactor;

        if (dist <= move) {
            this.target.takeDamage(this.damage, this.element);
            if (this.isCrit) {
                 game.particles.push(new TextParticle(this.target.x, this.target.y - 15, "暴擊!", '#ff0000'));
            }
            this.dead = true;
            
            // Special Effects based on Element/Skill
            if (this.element === ELEMENTS.WATER || this.skillEffect === 'slow') this.target.frozen = 60; // Slow 1s
            if (this.element === ELEMENTS.POISON || this.skillEffect === 'poison') {
                this.target.poisoned = 20; // Dmg/sec
                this.target.poisonTimer = 0;
            }

        } else {
            this.x += (dx/dist) * move;
            this.y += (dy/dist) * move;
        }
    }

    draw() {
        ctx.fillStyle = ELEMENT_COLORS[this.element];
        ctx.beginPath();
        const size = this.isCrit ? 6 : 4;
        ctx.arc(this.x, this.y, size, 0, Math.PI*2);
        ctx.fill();
    }
}

class TextParticle {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 30;
    }
    update() {
        this.y -= 1 * game.speedFactor;
        this.life -= game.speedFactor;
    }
    draw() {
        ctx.globalAlpha = this.life / 30;
        ctx.fillStyle = this.color;
        ctx.font = '12px Arial';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1.0;
    }
}

// --- Engine ---

function init() {
    // Generate UI
    const list = document.getElementById('towers-list');
    TOWER_TYPES.forEach(t => {
        const div = document.createElement('div');
        div.className = 'tower-card';
        div.innerHTML = `
            <div class="tower-icon" style="background:${t.color}; border-radius:50%;"></div>
            <strong>${t.name.split(' ')[0]}</strong>
            <span class="element-badge" style="background:${t.color}33;">${t.element}</span>
            <div style="margin-top:2px;">$${t.cost}</div>
        `;
        div.onclick = () => selectTowerToBuild(t.id);
        list.appendChild(div);
    });

    // Event Listeners
    canvas.addEventListener('mousedown', onCanvasClick);
    document.getElementById('start-wave-btn').addEventListener('click', startNextWave);
    document.getElementById('speed-btn').addEventListener('click', toggleSpeed);
    document.getElementById('upgrade-btn').addEventListener('click', upgradeSelected);
    document.getElementById('sell-btn').addEventListener('click', sellSelected);
    
    // Mouse Move for Cursor
    canvas.addEventListener('mousemove', onCanvasMouseMove);

    // Initial Draw
    updateUI();
    draw();
    
    // Start Loop
    requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
    if (!game.lastTime) game.lastTime = timestamp;
    const delta = timestamp - game.lastTime;

    if (delta >= 1000 / (FPS * (game.speedFactor === 2 ? 2 : 1))) {
        update();
        draw();
        game.lastTime = timestamp;
    }
    
    game.loopId = requestAnimationFrame(gameLoop);
}

function update() {
    if (game.lives <= 0) return;


    // Wave Spawning
    if (game.waveActive) {
        if (game.enemiesToSpawn > 0) {
            game.spawnTimer -= game.speedFactor;
            if (game.spawnTimer <= 0) {
                const config = WAVES[game.wave - 1];
                game.enemies.push(new Enemy(game.wave - 1));
                game.enemiesToSpawn--;
                game.spawnTimer = config.interval;
            }
        } else if (game.enemies.length === 0) {
            endWave();
        }
    } else if (game.isGameStarted && game.autoNextWaveTimer > 0) {
        // Auto Next Wave Countdown
        game.autoNextWaveTimer -= (1 / FPS) * game.speedFactor;
        if (game.autoNextWaveTimer <= 0) {
            game.autoNextWaveTimer = 0;
            startNextWave();
        } else {
            // Update UI for Countdown
             const btn = document.getElementById('start-wave-btn');
             btn.textContent = `下一波 (${Math.ceil(game.autoNextWaveTimer)}s)`;
        }
    }

    // Entities
    game.enemies.forEach(e => e.update());
    // Filter dead enemies (handled inside update to allow "die" logic to run)
    game.enemies = game.enemies.filter(e => !e.dead);

    game.towers.forEach(t => t.update());
    // Filter destroyed towers
    game.towers = game.towers.filter(t => !t.dead);
    
    game.projectiles.forEach(p => p.update());
    game.projectiles = game.projectiles.filter(p => !p.dead);
    
    game.particles.forEach(p => p.update());
    game.particles = game.particles.filter(p => p.life > 0);
}

function draw() {
    // Canvas Resizing Logic
    const wrapper = document.getElementById('canvas-wrapper');
    const targetWidth = wrapper.clientWidth;
    const targetHeight = wrapper.clientHeight;
    
    // Update internal size to match display size for crisp rendering
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
    }

    // Clear
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate Scale to fit the 800x600 logical game into the current canvas
    // We want to "contain" the game board
    const scaleX = canvas.width / CANVAS_WIDTH;
    const scaleY = canvas.height / CANVAS_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    
    const offsetX = (canvas.width - CANVAS_WIDTH * scale) / 2;
    const offsetY = (canvas.height - CANVAS_HEIGHT * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw Background/Board Area
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Path
    ctx.strokeStyle = '#555';
    ctx.lineWidth = TILE_SIZE;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(PATH_POINTS[0].x * TILE_SIZE + TILE_SIZE/2, PATH_POINTS[0].y * TILE_SIZE + TILE_SIZE/2);
    for(let i=1; i<PATH_POINTS.length; i++) {
        ctx.lineTo(PATH_POINTS[i].x * TILE_SIZE + TILE_SIZE/2, PATH_POINTS[i].y * TILE_SIZE + TILE_SIZE/2);
    }
    ctx.stroke();

    // Draw Grid (Optional, faint)
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    for(let i=0; i<=CANVAS_WIDTH; i+=TILE_SIZE) {
        ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke();
    }
    for(let i=0; i<=CANVAS_HEIGHT; i+=TILE_SIZE) {
        ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(CANVAS_WIDTH, i); ctx.stroke();
    }

    // Entities
    game.towers.forEach(t => t.draw());
    game.enemies.forEach(e => e.draw());
    game.projectiles.forEach(p => p.draw());
    game.particles.forEach(p => p.draw());

    // Highlight Selected
    if (game.selectedTower) {
        const t = game.selectedTower;
        ctx.strokeStyle = '#ffca28';
        ctx.lineWidth = 2;
        ctx.strokeRect(t.gridX*TILE_SIZE, t.gridY*TILE_SIZE, TILE_SIZE, TILE_SIZE);
        
        // Range
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.baseRange, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.stroke();
    }
    
    // Ghost Tower (Build Mode)
    if (buildModeId !== null) {
         // Get mouse pos from global state if tracked, or we can just rely on the fact 
         // that we need to track mouse for this feature properly.
         // Let's use the game.mouseX/Y we declared earlier but haven't used yet.
         // Or simpler: use the last known mouse position from onCanvasMouseMove
         
         if (game.mouseX && game.mouseY) {
            const gx = Math.floor(game.mouseX / TILE_SIZE);
            const gy = Math.floor(game.mouseY / TILE_SIZE);
            
            if (gx >= 0 && gx < CANVAS_WIDTH/TILE_SIZE && gy >= 0 && gy < CANVAS_HEIGHT/TILE_SIZE) {
                const cx = gx * TILE_SIZE + TILE_SIZE/2;
                const cy = gy * TILE_SIZE + TILE_SIZE/2;
                const type = TOWER_TYPES[buildModeId];

                // Draw Ghost Range
                ctx.beginPath();
                ctx.arc(cx, cy, type.range, 0, Math.PI*2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.stroke();
                
                // Draw Ghost Tower (Semi-transparent)
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = type.color;
                ctx.beginPath();
                // Simple shape rep
                ctx.arc(cx, cy, 15, 0, Math.PI*2); 
                ctx.fill();
                ctx.globalAlpha = 1.0;
                
                // Color indication if valid
                const valid = !isPath(gx, gy) && !game.towers.find(t => t.gridX === gx && t.gridY === gy);
                ctx.fillStyle = valid ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
                ctx.fillRect(gx * TILE_SIZE, gy * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
         }
    }

    ctx.restore();
}

// --- Interaction ---

let buildModeId = null;

function showNotification(msg) {
    const overlay = document.getElementById('notification-overlay');
    const div = document.createElement('div');
    div.className = 'notification';
    div.textContent = msg;
    overlay.appendChild(div);
    setTimeout(() => {
        if (div.parentNode) div.parentNode.removeChild(div);
    }, 3000);
}

function selectTowerToBuild(id) {
    if (game.gold >= TOWER_TYPES[id].cost) {
        buildModeId = id;
        game.selectedTower = null;
        updateUI();
        document.body.style.cursor = 'crosshair';
        showNotification(`已選擇 ${TOWER_TYPES[id].name}。請點擊地圖建造。`);
    } else {
        showNotification("金錢不足!");
    }
}

function onCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    
    // Reverse Scale Calculation
    const scaleX = canvas.width / CANVAS_WIDTH;
    const scaleY = canvas.height / CANVAS_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvas.width - CANVAS_WIDTH * scale) / 2;
    const offsetY = (canvas.height - CANVAS_HEIGHT * scale) / 2;

    const clickX = e.clientX - rect.left - offsetX;
    const clickY = e.clientY - rect.top - offsetY;

    const gameX = clickX / scale;
    const gameY = clickY / scale;

    // Check Enemy Click (Tap Damage)
    for (let i = game.enemies.length - 1; i >= 0; i--) {
        const e = game.enemies[i];
        // Hitbox approx 30px radius scaled
        const dist = Math.sqrt((e.x - gameX) ** 2 + (e.y - gameY) ** 2);
        if (dist < 30 * e.scale) { 
            const clickDmg = 10 + (game.wave * 5); // Base 10 + 5 per wave
            e.takeDamage(clickDmg, ELEMENTS.NONE);
            game.particles.push(new TextParticle(e.x, e.y - 40, "點擊!", '#ffffff'));
            return; // Handled click
        }
    }

    const x = Math.floor(gameX / TILE_SIZE);
    const y = Math.floor(gameY / TILE_SIZE);

    // Validate bounds
    if (x < 0 || x >= CANVAS_WIDTH/TILE_SIZE || y < 0 || y >= CANVAS_HEIGHT/TILE_SIZE) return;

    // Check collision with path
    if (isPath(x, y)) {
         showNotification("不能建造在路徑上!");
         return;
    }

    // Check existing tower
    const existing = game.towers.find(t => t.gridX === x && t.gridY === y);

    if (buildModeId !== null) {
        if (!existing) {
            // Build
            const type = TOWER_TYPES[buildModeId];
            if (game.gold >= type.cost) {
                game.gold -= type.cost;
                game.towers.push(new Tower(buildModeId, x, y));
                buildModeId = null;
                document.body.style.cursor = 'default';
                updateUI();
                showNotification("防禦塔建造完成!");
            }
        } else {
            showNotification("該位置已被佔用!");
        }
    } else {
        if (existing) {
            game.selectedTower = existing;
            updateTowerInfo();
        } else {
            game.selectedTower = null;
            document.getElementById('selection-info').style.display = 'none';
        }
    }
}

function onCanvasMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / CANVAS_WIDTH;
    const scaleY = canvas.height / CANVAS_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvas.width - CANVAS_WIDTH * scale) / 2;
    const offsetY = (canvas.height - CANVAS_HEIGHT * scale) / 2;

    const mouseX = e.clientX - rect.left - offsetX;
    const mouseY = e.clientY - rect.top - offsetY;

    const gameX = mouseX / scale;
    const gameY = mouseY / scale;

    // Save for draw() loop
    game.mouseX = gameX;
    game.mouseY = gameY;

    if (buildModeId !== null) return; // Keep crosshair if building

    let hoveringEnemy = false;
    for (const e of game.enemies) {
        const dist = Math.sqrt((e.x - gameX) ** 2 + (e.y - gameY) ** 2);
        if (dist < 30 * e.scale) {
            hoveringEnemy = true;
            break;
        }
    }

    if (hoveringEnemy) {
        document.body.style.cursor = 'pointer';
    } else {
        document.body.style.cursor = 'default';
    }
}

function isPath(x, y) {
    // Simple segment check
    for(let i=0; i<PATH_POINTS.length-1; i++) {
        const p1 = PATH_POINTS[i];
        const p2 = PATH_POINTS[i+1];
        
        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);

        if (x >= minX && x <= maxX && y >= minY && y <= maxY) return true;
    }
    return false;
}

// --- Game Flow ---

function startNextWave() {
    if (game.waveActive || game.wave > 100) return;
    
    game.waveActive = true;
    game.autoNextWaveTimer = 0; // Clear timer
    const config = WAVES[game.wave - 1];
    game.enemiesToSpawn = config.count;
    game.spawnTimer = 0;
    
    const btn = document.getElementById('start-wave-btn');
    btn.disabled = true;
    btn.textContent = "波次進行中...";
    updateUI();
}

function endWave() {
    game.waveActive = false;
    game.wave++;
    
    // Wave Bonus
    const bonus = 100 + (game.wave * 25);
    game.gold += bonus;
    showNotification(`波次完成! 獲得 +$${bonus} 金幣。 塔樓已修復。`);
    
    // Heal/Buff Towers
    game.towers.forEach(t => {
        t.maxHp += 10;
        t.hp += 20;
        if(t.hp > t.maxHp) t.hp = t.maxHp;
    });

    if (game.wave > 100) {
        showNotification("勝利! 100關全破!");
        game.wave = 100; // Cap
    } else {
        // Start Auto Timer
        game.autoNextWaveTimer = 10; // 10 seconds
        document.getElementById('start-wave-btn').disabled = false;
    }
    updateUI();
}

function gameOver() {
    showNotification("遊戲結束 - 重新載入...");
    setTimeout(() => location.reload(), 3000);
}

function toggleSpeed() {
    game.speedFactor = game.speedFactor === 1 ? 2 : 1;
    const btn = document.getElementById('speed-btn');
    btn.textContent = game.speedFactor + 'x 速度';
    btn.className = game.speedFactor === 2 ? 'x2' : '';
}

function upgradeSelected() {
    const t = game.selectedTower;
    if (!t) return;
    const cost = t.getUpgradeCost();
    if (game.gold >= cost) {
        game.gold -= cost;
        t.level++;
        t.spent += cost;
        updateUI();
        updateTowerInfo();
    }
}

function sellSelected() {
    const t = game.selectedTower;
    if (!t) return;
    game.gold += t.getCost();
    game.towers = game.towers.filter(tower => tower !== t);
    game.selectedTower = null;
    document.getElementById('selection-info').style.display = 'none';
    updateUI();
}

// --- UI Updates ---

function startGame() {
    document.getElementById('splash-screen').style.display = 'none';
    game.isGameStarted = true;
    game.autoNextWaveTimer = 10; // Start Countdown for Wave 1
    updateUI();
}

function updateUI() {
    document.getElementById('gold-display').textContent = game.gold;
    document.getElementById('lives-display').textContent = game.lives;
    document.getElementById('wave-display').textContent = `${game.wave} / 100`;
    document.getElementById('score-display').textContent = game.score;

    // Next Wave Info
    if (game.wave <= 100) {
        const next = WAVES[game.wave - 1];
        document.getElementById('next-wave-details').innerHTML = `
            屬性: <span style="color:${ELEMENT_COLORS[next.element]}">${next.element}</span><br>
            數量: ${next.count}<br>
            血量: ${next.hp}
        `;
    } else {
        document.getElementById('next-wave-details').textContent = "全數通關!";
    }
}

function updateTowerInfo() {
    const t = game.selectedTower;
    if (!t) return;
    
    const info = document.getElementById('selection-info');
    info.style.display = 'block';
    
    document.getElementById('sel-name').textContent = TOWER_TYPES[t.typeId].name;
    document.getElementById('sel-type').textContent = t.element;
    document.getElementById('sel-hp').textContent = `${Math.floor(t.hp)}/${t.maxHp}`;
    document.getElementById('sel-dmg').textContent = t.getDamage();
    document.getElementById('sel-speed').textContent = t.baseCooldown;
    document.getElementById('sel-range').textContent = t.baseRange / TILE_SIZE;
    document.getElementById('sel-level').textContent = t.level;
    
    // Skill info
    const skillRow = document.getElementById('skill-row');
    const skillSpan = document.getElementById('sel-skill');
    const skillBtn = document.getElementById('cast-skill-btn');
    
    const type = TOWER_TYPES[t.typeId];
    if (type.skill) {
        skillRow.style.display = 'flex';
        skillSpan.textContent = type.skillDesc;
        
        if (type.skill === 'nuke') {
            skillBtn.style.display = 'block';
            if (t.activeSkillCd > 0) {
                skillBtn.disabled = true;
                skillBtn.textContent = `冷卻中 (${Math.ceil(t.activeSkillCd/60)}s)`;
                skillBtn.style.background = '#555';
            } else {
                skillBtn.disabled = false;
                skillBtn.textContent = "主動: 核彈 (就緒)";
                skillBtn.style.background = '#7b1fa2';
                skillBtn.onclick = () => {
                    if (t.triggerActiveSkill()) {
                        // Success
                    }
                };
            }
        } else {
            skillBtn.style.display = 'none';
        }
    } else {
        skillRow.style.display = 'none';
        skillBtn.style.display = 'none';
    }
    
    document.getElementById('upg-cost').textContent = t.getUpgradeCost();
    document.getElementById('sell-cost').textContent = t.getCost();
}

// Boot
window.onload = init;
